import math
import hashlib
import json
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict

from backend.app.core.domain import (
    Node,
    Product,
    PhysicalLink,
    ServiceDependency,
    InventoryPosition,
    SupplyProfile,
    DemandProfile,
    IncidentScenario,
    MitigationOption,
    DailyMetricRow,
    OperationalEventRow,
    InTransitShipment,
    SimulationRunSummary,
    ActionType,
    MitigationCombineMode,
    CapacityMode,
)
from backend.app.services.dependency_service import DependencyService


class SimulationEngine:
    VERSION = "0.1.0"

    def __init__(
        self,
        nodes: List[Node],
        products: List[Product],
        links: List[PhysicalLink],
        dependencies: List[ServiceDependency],
        inventory: List[InventoryPosition],
        supply_profiles: List[SupplyProfile],
        demand_profiles: List[DemandProfile],
    ):
        self.nodes = {n.id: n for n in sorted(nodes, key=lambda x: x.id)}
        self.products = {p.id: p for p in sorted(products, key=lambda x: x.id)}
        self.links = {l.id: l for l in sorted(links, key=lambda x: x.id)}
        self.dependencies = sorted(dependencies, key=lambda x: x.id)
        self.inventory = inventory
        self.supply_profiles = supply_profiles
        self.demand_profiles = demand_profiles

        self.dep_service = DependencyService(nodes, links, dependencies)

    def calculate_input_hash(self, scenario: IncidentScenario, mitigations: List[MitigationOption], horizon_days: int) -> str:
        payload = {
            "scenario": {
                "id": scenario.id,
                "target": scenario.target_node_id,
                "start": scenario.start_day,
                "duration": scenario.duration_days,
                "factor": scenario.remaining_capacity_factor,
                "capacity_mode": scenario.capacity_mode.value,
                "absolute_capacity_value": scenario.absolute_capacity_value,
            },
            "mitigations": [
                {
                    "id": m.id,
                    "action_type": m.action_type.value,
                    "target_link": m.target_link_id,
                    "target_node": m.target_node_id,
                    "start": m.start_day,
                    "end": m.end_day,
                    "mode": m.capacity_effect.value,
                    "value": m.capacity_value,
                }
                for m in sorted(mitigations, key=lambda x: x.id)
            ],
            "horizon": horizon_days,
            "nodes": [n.id for n in sorted(self.nodes.values(), key=lambda x: x.id)],
            "links": [
                (l.id, l.origin_node_id, l.destination_node_id, l.max_units_per_day, l.transit_days)
                for l in sorted(self.links.values(), key=lambda x: x.id)
            ],
        }
        canonical_str = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def run(
        self,
        scenario: IncidentScenario,
        mitigations: Optional[List[MitigationOption]] = None,
        horizon_days: int = 10,
        run_id: str = "run-1",
    ) -> SimulationRunSummary:
        if mitigations is None:
            mitigations = []

        mitigations = sorted(mitigations, key=lambda m: m.id)
        input_hash = self.calculate_input_hash(scenario, mitigations, horizon_days)

        current_stock: Dict[Tuple[str, str], int] = defaultdict(int)
        storage_caps: Dict[Tuple[str, str], Optional[int]] = {}

        for inv in self.inventory:
            current_stock[(inv.node_id, inv.product_id)] = int(inv.on_hand_units)
            storage_caps[(inv.node_id, inv.product_id)] = inv.storage_capacity_units

        in_transit_shipments: List[InTransitShipment] = []
        shipment_counter = 0
        event_counter = 0

        daily_metric_rows: List[DailyMetricRow] = []
        operational_events: List[OperationalEventRow] = []

        total_demand = 0
        total_fulfilled = 0
        total_unmet = 0
        first_shortage_day: Optional[int] = None
        total_overflow = 0

        cost_known = True
        total_cost = 0.0

        assumptions_summary: List[str] = [
            f"Horizon: {horizon_days} integer days.",
            f"Order of operations: supply production -> shipment arrivals -> local demand fulfilment -> outbound dispatch -> balance check.",
            f"Unmet demand is lost (not backlogged).",
            f"Fractional capacity is floored to integer units.",
            f"Incident status: {scenario.status.value.upper()}.",
        ]

        if scenario.target_node_id in self.nodes:
            target_name = self.nodes[scenario.target_node_id].name
            assumptions_summary.append(
                f"Incident '{scenario.name}' on {target_name} active days {scenario.start_day} to {scenario.start_day + scenario.duration_days - 1}."
            )

        setup_costs_incurred: Set[str] = set()

        for day in range(1, horizon_days + 1):
            # 1. Resolve daily node and link factors
            impact_map = self.dep_service.propagate_service_impact(scenario, day)

            active_node_factors: Dict[str, float] = {}
            for nid in self.nodes:
                active_node_factors[nid] = impact_map[nid]["factor"]

            scenario_active = (scenario.start_day <= day < scenario.start_day + scenario.duration_days)
            scenario_abs_override: Dict[str, int] = {}
            if scenario_active and scenario.capacity_mode == CapacityMode.ABSOLUTE:
                if scenario.absolute_capacity_value is not None:
                    # Apply to target node
                    scenario_abs_override[scenario.target_node_id] = scenario.absolute_capacity_value
                    # If target is a digital service, propagate absolute cap to dependent operational nodes
                    for dep in self.dependencies:
                        if dep.service_node_id == scenario.target_node_id:
                            scenario_abs_override[dep.dependent_node_id] = scenario.absolute_capacity_value

            active_mitigations = [
                m for m in mitigations
                if m.start_day <= day and (m.end_day is None or day <= m.end_day)
            ]

            for m in active_mitigations:
                if m.id not in setup_costs_incurred and m.start_day == day:
                    setup_costs_incurred.add(m.id)
                    if m.setup_cost is not None:
                        total_cost += float(m.setup_cost)
                    else:
                        cost_known = False

            link_enabled: Dict[str, bool] = {l.id: l.baseline_enabled for l in self.links.values()}
            link_capacity_overrides: Dict[str, Optional[int]] = {l.id: None for l in self.links.values()}
            link_additive_capacity: Dict[str, int] = {l.id: 0 for l in self.links.values()}

            node_capacity_overrides: Dict[str, Optional[int]] = {n.id: None for n in self.nodes.values()}
            node_additive_capacity: Dict[str, int] = {n.id: 0 for n in self.nodes.values()}

            for m in active_mitigations:
                if m.action_type == ActionType.ACTIVATE_LINK and m.target_link_id:
                    link_enabled[m.target_link_id] = True
                    if m.target_link_id in self.links:
                        if m.capacity_effect == MitigationCombineMode.REPLACE:
                            link_capacity_overrides[m.target_link_id] = m.capacity_value
                        else:
                            link_additive_capacity[m.target_link_id] += m.capacity_value

            replaces = [m for m in active_mitigations if m.action_type == ActionType.CAPACITY_OVERRIDE and m.capacity_effect == MitigationCombineMode.REPLACE]
            adds = [m for m in active_mitigations if m.action_type == ActionType.CAPACITY_OVERRIDE and m.capacity_effect == MitigationCombineMode.ADD]

            for m in replaces:
                if m.target_link_id:
                    link_capacity_overrides[m.target_link_id] = m.capacity_value
                    link_enabled[m.target_link_id] = True
                if m.target_node_id:
                    node_capacity_overrides[m.target_node_id] = m.capacity_value

            for m in adds:
                if m.target_link_id:
                    link_additive_capacity[m.target_link_id] += m.capacity_value
                    link_enabled[m.target_link_id] = True
                if m.target_node_id:
                    node_additive_capacity[m.target_node_id] += m.capacity_value

            # Track activity per operational facility on this day
            facility_activity: Dict[str, int] = defaultdict(int)

            # 2. Add source production / supply active on day t
            daily_supply_added: Dict[Tuple[str, str], int] = defaultdict(int)
            daily_overflow: Dict[Tuple[str, str], int] = defaultdict(int)

            for sp in self.supply_profiles:
                if sp.active_from_day <= day <= sp.active_to_day:
                    key = (sp.node_id, sp.product_id)
                    node_fac = active_node_factors.get(sp.node_id, 1.0)
                    
                    if sp.node_id in node_capacity_overrides and node_capacity_overrides[sp.node_id] is not None:
                        prod = node_capacity_overrides[sp.node_id] + node_additive_capacity.get(sp.node_id, 0)
                    elif sp.node_id in scenario_abs_override:
                        prod = scenario_abs_override[sp.node_id] + node_additive_capacity.get(sp.node_id, 0)
                    else:
                        prod = math.floor(sp.units_per_day * node_fac) + node_additive_capacity.get(sp.node_id, 0)

                    prod = max(0, int(prod))
                    cap = storage_caps.get(key)
                    if cap is not None:
                        space = max(0, cap - current_stock[key])
                        accepted = min(prod, space)
                        overflow = prod - accepted
                    else:
                        accepted = prod
                        overflow = 0

                    current_stock[key] += accepted
                    daily_supply_added[key] += accepted
                    daily_overflow[key] += overflow
                    total_overflow += overflow

                    if accepted > 0:
                        facility_activity[sp.node_id] += 1
                        event_counter += 1
                        facility_name = self.nodes[sp.node_id].name if sp.node_id in self.nodes else sp.node_id
                        is_throttled = (node_fac < 1.0 or sp.node_id in scenario_abs_override)
                        operational_events.append(OperationalEventRow(
                            event_id=f"EVT-SUP-{event_counter:04d}",
                            day=day,
                            facility_id=sp.node_id,
                            facility_name=facility_name,
                            event_type="inbound_consignment",
                            counterpart="Manufacturing / Port Berth Feeder",
                            units_delta=accepted,
                            balance_after=current_stock[key],
                            impact_level="warning" if is_throttled else "normal",
                            description=f"Replenishment received: +{accepted} cartons" + (f" (degraded from {sp.units_per_day})" if is_throttled and accepted < sp.units_per_day else ""),
                        ))

            # 3. Receive in-transit shipments arriving on day t
            daily_arrivals_due: Dict[Tuple[str, str], int] = defaultdict(int)
            daily_arrivals_accepted: Dict[Tuple[str, str], int] = defaultdict(int)

            due_shipments = [s for s in in_transit_shipments if s.arrival_day == day]
            due_shipments.sort(key=lambda s: s.shipment_id)

            for s in due_shipments:
                key = (s.destination_node_id, s.product_id)
                daily_arrivals_due[key] += s.quantity
                cap = storage_caps.get(key)
                if cap is not None:
                    space = max(0, cap - current_stock[key])
                    accepted = min(s.quantity, space)
                    overflow = s.quantity - accepted
                else:
                    accepted = s.quantity
                    overflow = 0

                current_stock[key] += accepted
                daily_arrivals_accepted[key] += accepted
                daily_overflow[key] += overflow
                total_overflow += overflow

                if accepted > 0:
                    facility_activity[s.destination_node_id] += 1
                    event_counter += 1
                    dest_name = self.nodes[s.destination_node_id].name if s.destination_node_id in self.nodes else s.destination_node_id
                    orig_name = self.nodes[s.origin_node_id].name if s.origin_node_id in self.nodes else s.origin_node_id
                    is_alt = s.link_id in [m.target_link_id for m in mitigations]
                    operational_events.append(OperationalEventRow(
                        event_id=f"EVT-ARR-{event_counter:04d}",
                        day=day,
                        facility_id=s.destination_node_id,
                        facility_name=dest_name,
                        event_type="inbound_consignment",
                        counterpart=orig_name,
                        units_delta=accepted,
                        balance_after=current_stock[key],
                        impact_level="mitigation" if is_alt else "normal",
                        description=f"Consignment arrived from {orig_name} (+{accepted} units)",
                    ))

            # 4. Fulfil local demand
            daily_demand: Dict[Tuple[str, str], int] = defaultdict(int)
            daily_fulfilled: Dict[Tuple[str, str], int] = defaultdict(int)
            daily_unmet: Dict[Tuple[str, str], int] = defaultdict(int)

            for dp in self.demand_profiles:
                if dp.active_from_day <= day <= dp.active_to_day:
                    key = (dp.node_id, dp.product_id)
                    dem = int(dp.units_per_day)
                    daily_demand[key] += dem
                    total_demand += dem

                    avail = current_stock[key]
                    ful = min(avail, dem)
                    unm = dem - ful

                    current_stock[key] -= ful
                    daily_fulfilled[key] += ful
                    daily_unmet[key] += unm
                    total_fulfilled += ful
                    total_unmet += unm

                    facility_name = self.nodes[dp.node_id].name if dp.node_id in self.nodes else dp.node_id

                    if ful > 0:
                        facility_activity[dp.node_id] += 1
                        event_counter += 1
                        operational_events.append(OperationalEventRow(
                            event_id=f"EVT-FUL-{event_counter:04d}",
                            day=day,
                            facility_id=dp.node_id,
                            facility_name=facility_name,
                            event_type="outbound_dispatch",
                            counterpart="Regional Hospital Quota & Outbound Replenishment",
                            units_delta=-ful,
                            balance_after=current_stock[key],
                            impact_level="normal",
                            description=f"Replenishment demand served: -{ful} units",
                        ))

                    if unm > 0:
                        facility_activity[dp.node_id] += 1
                        event_counter += 1
                        if first_shortage_day is None:
                            first_shortage_day = day
                        operational_events.append(OperationalEventRow(
                            event_id=f"EVT-SHT-{event_counter:04d}",
                            day=day,
                            facility_id=dp.node_id,
                            facility_name=facility_name,
                            event_type="shortage",
                            counterpart="Regional Healthcare Network Deficit",
                            units_delta=0,
                            balance_after=0,
                            impact_level="critical",
                            description=f"CRITICAL SHORTAGE: Unmet demand of {unm} units! Stock depleted.",
                        ))

            # 5. Outbound dispatch across outgoing links
            daily_dispatched: Dict[Tuple[str, str], int] = defaultdict(int)
            sorted_links = sorted(self.links.values(), key=lambda l: (l.priority, l.id))

            for link in sorted_links:
                if not link_enabled.get(link.id, False):
                    continue

                prod_id = link.product_id
                orig_key = (link.origin_node_id, prod_id)
                orig_factor = active_node_factors.get(link.origin_node_id, 1.0)

                if link_capacity_overrides.get(link.id) is not None:
                    base_cap = link_capacity_overrides[link.id]
                elif link.id in scenario_abs_override:
                    base_cap = scenario_abs_override[link.id]
                elif link.origin_node_id in scenario_abs_override:
                    base_cap = scenario_abs_override[link.origin_node_id]
                else:
                    base_cap = math.floor(link.max_units_per_day * orig_factor)

                eff_cap = max(0, base_cap + link_additive_capacity.get(link.id, 0))
                avail_stock = current_stock[orig_key]
                qty_to_send = min(avail_stock, eff_cap)

                if qty_to_send > 0:
                    current_stock[orig_key] -= qty_to_send
                    daily_dispatched[orig_key] += qty_to_send

                    facility_activity[link.origin_node_id] += 1
                    event_counter += 1
                    orig_name = self.nodes[link.origin_node_id].name if link.origin_node_id in self.nodes else link.origin_node_id
                    dest_name = self.nodes[link.destination_node_id].name if link.destination_node_id in self.nodes else link.destination_node_id

                    operational_events.append(OperationalEventRow(
                        event_id=f"EVT-DSP-{event_counter:04d}",
                        day=day,
                        facility_id=link.origin_node_id,
                        facility_name=orig_name,
                        event_type="outbound_dispatch",
                        counterpart=dest_name,
                        units_delta=-qty_to_send,
                        balance_after=current_stock[orig_key],
                        impact_level="normal",
                        description=f"Consignment dispatched to {dest_name} (-{qty_to_send} units via corridor {link.id})",
                    ))

                    arrival_day = day + max(0, link.transit_days)
                    shipment_counter += 1
                    shipment = InTransitShipment(
                        shipment_id=f"shp-{shipment_counter:04d}",
                        link_id=link.id,
                        origin_node_id=link.origin_node_id,
                        destination_node_id=link.destination_node_id,
                        product_id=prod_id,
                        quantity=qty_to_send,
                        dispatch_day=day,
                        arrival_day=arrival_day,
                    )

                    if link.transit_days == 0:
                        dest_key = (link.destination_node_id, prod_id)
                        dest_cap = storage_caps.get(dest_key)
                        if dest_cap is not None:
                            spc = max(0, dest_cap - current_stock[dest_key])
                            acc = min(qty_to_send, spc)
                            ovf = qty_to_send - acc
                        else:
                            acc = qty_to_send
                            ovf = 0
                        current_stock[dest_key] += acc
                        daily_arrivals_accepted[dest_key] += acc
                        daily_overflow[dest_key] += ovf
                        total_overflow += ovf

                        if acc > 0:
                            facility_activity[link.destination_node_id] += 1
                            event_counter += 1
                            operational_events.append(OperationalEventRow(
                                event_id=f"EVT-ARR-{event_counter:04d}",
                                day=day,
                                facility_id=link.destination_node_id,
                                facility_name=dest_name,
                                event_type="inbound_consignment",
                                counterpart=orig_name,
                                units_delta=acc,
                                balance_after=current_stock[dest_key],
                                impact_level="normal",
                                description=f"Consignment arrived from {orig_name} (+{acc} units same-day delivery)",
                            ))
                    else:
                        in_transit_shipments.append(shipment)

                    if link.cost_per_unit is not None:
                        total_cost += float(link.cost_per_unit) * qty_to_send
                    else:
                        cost_known = False

            # 6. Check for quiescent facilities on this day (User requirement:
            # "if nothing happens in a day then there should only be 1 entry of that day in the table showing nothing changed")
            for node in self.nodes.values():
                if not node.is_operational:
                    continue
                if facility_activity[node.id] == 0:
                    event_counter += 1
                    # Total current stock at this facility
                    node_stock = sum(current_stock[(node.id, p.id)] for p in self.products.values())
                    operational_events.append(OperationalEventRow(
                        event_id=f"EVT-QST-{event_counter:04d}",
                        day=day,
                        facility_id=node.id,
                        facility_name=node.name,
                        event_type="quiescent",
                        counterpart="Stable Operational Buffer",
                        units_delta=0,
                        balance_after=node_stock,
                        impact_level="normal",
                        description="No consignment movements",
                    ))

            active_pipeline = [s for s in in_transit_shipments if s.arrival_day > day]
            pipeline_by_key: Dict[Tuple[str, str], int] = defaultdict(int)
            for s in active_pipeline:
                pipeline_by_key[(s.destination_node_id, s.product_id)] += s.quantity

            # 7. Record daily metric rows and verify invariant
            for node in self.nodes.values():
                if not node.is_operational:
                    continue
                for prod in self.products.values():
                    key = (node.id, prod.id)
                    dem = daily_demand.get(key, 0)
                    ful = daily_fulfilled.get(key, 0)
                    unm = daily_unmet.get(key, 0)
                    sup = daily_supply_added.get(key, 0)
                    arr_due = daily_arrivals_due.get(key, 0)
                    arr_acc = daily_arrivals_accepted.get(key, 0)
                    disp = daily_dispatched.get(key, 0)
                    ovf = daily_overflow.get(key, 0)
                    ending = current_stock[key]
                    in_tr = pipeline_by_key[key]

                    opening = ending - sup - arr_acc + ful + disp + ovf

                    reasons = list(impact_map[node.id]["reasons"])
                    if active_node_factors[node.id] < 1.0:
                        reasons.append(f"Operating at {active_node_factors[node.id]:.1%} throughput")

                    metric_row = DailyMetricRow(
                        day=day,
                        node_id=node.id,
                        product_id=prod.id,
                        opening_inventory=opening,
                        supply_added=sup,
                        arrivals_due=arr_due,
                        arrivals_accepted=arr_acc,
                        demand=dem,
                        fulfilled=ful,
                        unmet=unm,
                        outbound_dispatched=disp,
                        overflow_removed=ovf,
                        ending_inventory=ending,
                        in_transit_units=in_tr,
                        effective_capacity_factor=active_node_factors[node.id],
                        impact_reasons=reasons,
                    )

                    if not metric_row.verify_invariant():
                        raise ValueError(
                            f"Invariant failed for node {node.id}, product {prod.id} on day {day}: "
                            f"{opening} + {sup} + {arr_acc} - {ful} - {disp} - {ovf} != {ending}"
                        )
                    if metric_row.ending_inventory < 0:
                        raise ValueError(
                            f"Negative inventory for node {node.id}, product {prod.id} on day {day}: {ending}"
                        )

                    daily_metric_rows.append(metric_row)

        total_ending_stock = sum(current_stock.values())
        total_in_transit = sum(s.quantity for s in in_transit_shipments if s.arrival_day > horizon_days)
        fill_rate = (total_fulfilled / total_demand * 100.0) if total_demand > 0 else None
        affected_trace = self.dep_service.trace_downstream_reachability(scenario.target_node_id)

        summary = SimulationRunSummary(
            run_id=run_id,
            scenario_id=scenario.id,
            horizon_days=horizon_days,
            input_hash=input_hash,
            engine_version=self.VERSION,
            total_demand_units=total_demand,
            fulfilled_units=total_fulfilled,
            unmet_units=total_unmet,
            fill_rate=round(fill_rate, 2) if fill_rate is not None else None,
            first_shortage_day=first_shortage_day,
            ending_stock=total_ending_stock,
            in_transit_units=total_in_transit,
            overflow_units=total_overflow,
            total_response_cost=round(total_cost, 2) if cost_known else None,
            cost_is_complete=cost_known,
            assumptions_summary=assumptions_summary,
            daily_rows=daily_metric_rows,
            events=operational_events,
            impacted_nodes=affected_trace,
        )
        return summary
