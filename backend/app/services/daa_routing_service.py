from typing import List, Dict, Any, Optional
import networkx as nx
from backend.app.data.custom_scenario import get_custom_network_scenario


class DaaRoutingEngine:
    def __init__(self):
        pass

    def evaluate_routes(
        self,
        port_a_active: bool = True,
        port_b_active: bool = True,
        demand_urgency_weight: float = 1.0,  # Multiplier for transit delay penalty
        shortage_penalty_per_unit: float = 150.0,
    ) -> Dict[str, Any]:
        """
        Runs DAA Dijkstra's shortest/cheapest path algorithm on the multi-echelon network.
        Evaluates primary vs alternative routes and computes the complete loss matrix.
        """
        nodes, links, deps, invs, supply, demand, incident, mitigations = get_custom_network_scenario()

        # Build NetworkX Directed Graph
        G = nx.DiGraph()

        node_map = {n.id: n for n in nodes}
        for n in nodes:
            G.add_node(
                n.id,
                name=n.name,
                node_type=n.node_type.value,
                lat=n.latitude,
                lon=n.longitude,
                city=n.city,
            )

        # Add edges with weighted costs:
        # Cost = Freight_Rate * Batch_Size + Toll + (Transit_Days * Urgency_Penalty)
        for link in links:
            # Check if link is available given active port status
            is_enabled = True
            if link.origin_node_id == "node-port-a" and not port_a_active:
                is_enabled = False
            if link.origin_node_id == "node-port-b" and not port_b_active:
                is_enabled = False

            # Compute combined DAA weight
            transit_penalty = link.transit_days * 200.0 * demand_urgency_weight
            weight = (link.freight_rate_per_unit * 10.0) + link.toll_cost + transit_penalty

            G.add_edge(
                link.origin_node_id,
                link.destination_node_id,
                id=link.id,
                weight=weight,
                distance_km=link.distance_km,
                toll_cost=link.toll_cost,
                freight_rate=link.freight_rate_per_unit,
                transit_days=link.transit_days,
                capacity=link.max_units_per_day,
                is_enabled=is_enabled,
                is_alternate=link.is_alternate,
            )

        # Detect key nodes dynamically based on node types
        source_nodes = [n for n in nodes if n.node_type.value in ("port", "supplier")]
        warehouse_nodes = [n for n in nodes if n.node_type.value in ("warehouse", "depot")]
        hospital_nodes = [n for n in nodes if n.node_type.value in ("hospital", "clinic")]

        primary_source_id = source_nodes[0].id if source_nodes else "node-port-a"
        alternate_source_id = source_nodes[1].id if len(source_nodes) > 1 else "node-port-b"
        warehouse_id = warehouse_nodes[0].id if warehouse_nodes else "node-warehouse-x"

        # 1. Primary Path evaluation (Primary Source -> Distribution Hub)
        primary_path_valid = port_a_active and nx.has_path(G, primary_source_id, warehouse_id)
        primary_cost = 0.0
        primary_distance = 0.0
        primary_tolls = 0.0
        primary_lead_time = 0
        primary_path = []

        if primary_path_valid:
            try:
                primary_path = nx.dijkstra_path(G, primary_source_id, warehouse_id, weight="weight")
                for u, v in zip(primary_path[:-1], primary_path[1:]):
                    e = G[u][v]
                    primary_cost += e["weight"]
                    primary_distance += e["distance_km"]
                    primary_tolls += e["toll_cost"]
                    primary_lead_time += e["transit_days"]
            except nx.NetworkXNoPath:
                primary_path_valid = False

        # 2. Alternate Contingency Path evaluation (Alternate Source -> Distribution Hub)
        alternate_path_valid = port_b_active and nx.has_path(G, alternate_source_id, warehouse_id)
        alternate_cost = 0.0
        alternate_distance = 0.0
        alternate_tolls = 0.0
        alternate_lead_time = 0
        alternate_path = []

        if alternate_path_valid:
            try:
                alternate_path = nx.dijkstra_path(G, alternate_source_id, warehouse_id, weight="weight")
                for u, v in zip(alternate_path[:-1], alternate_path[1:]):
                    e = G[u][v]
                    alternate_cost += e["weight"]
                    alternate_distance += e["distance_km"]
                    alternate_tolls += e["toll_cost"]
                    alternate_lead_time += e["transit_days"]
            except nx.NetworkXNoPath:
                alternate_path_valid = False

        # 3. Last-Mile Distribution paths (Warehouse -> Hospitals/Clinics)
        distribution_paths = {}
        for h in hospital_nodes:
            if nx.has_path(G, warehouse_id, h.id):
                try:
                    dist_p = nx.dijkstra_path(G, warehouse_id, h.id, weight="weight")
                    distribution_paths[h.id] = {
                        "path": dist_p,
                        "distance_km": sum(G[u][v]["distance_km"] for u, v in zip(dist_p[:-1], dist_p[1:])),
                        "lead_time_days": sum(G[u][v]["transit_days"] for u, v in zip(dist_p[:-1], dist_p[1:])),
                    }
                except nx.NetworkXNoPath:
                    pass

        # Compute Financial & Clinical Loss Analysis
        # Parameters: 10-day outage horizon, 4000 initial stock in Warehouse X, 1000 cartons/day total demand
        initial_warehouse_stock = 4000
        daily_total_demand = sum(dp.units_per_day for dp in demand) if demand else 1000
        outage_duration_days = 10

        # Scenario 1: Do Nothing (Primary source disrupted, contingency NOT activated)
        unmet_cartons_do_nothing = max(0, (outage_duration_days - 4) * daily_total_demand)
        shortage_loss_do_nothing = unmet_cartons_do_nothing * shortage_penalty_per_unit
        facility_downtime_loss = 100000.0  # Terminal idle & contract default fees
        total_do_nothing_loss = shortage_loss_do_nothing + facility_downtime_loss

        # Scenario 2: Mitigation Activated (Contingency Alternate activated)
        unmet_cartons_mitigated = 0
        setup_cost = 4500.0
        rerouted_units = 8 * 800  # 6,400 units
        freight_premium = rerouted_units * 18.0
        total_tolls_mitigated = 8 * 140.0
        total_mitigation_cost = setup_cost + freight_premium + total_tolls_mitigated

        net_savings = max(0.0, total_do_nothing_loss - total_mitigation_cost)
        roi_ratio = round(net_savings / total_mitigation_cost, 2) if total_mitigation_cost > 0 else 0.0

        # Serialize Nodes and Edges for Frontend GIS Map
        serialized_nodes = []
        for n in nodes:
            status = "normal"
            if n.id == primary_source_id and not port_a_active:
                status = "disrupted"
            elif n.id == alternate_source_id and not port_a_active and port_b_active:
                status = "active_alternate"
            elif n.node_type.value == "digital_service" and not port_a_active:
                status = "compromised"

            serialized_nodes.append({
                "id": n.id,
                "name": n.name,
                "type": n.node_type.value,
                "lat": n.latitude,
                "lon": n.longitude,
                "city": n.city,
                "criticality": n.criticality.value,
                "status": status,
                "notes": n.notes,
            })

        serialized_links = []
        for link in links:
            is_active_path = False
            if link.origin_node_id == primary_source_id and port_a_active:
                is_active_path = True
            elif link.origin_node_id == alternate_source_id and not port_a_active and port_b_active:
                is_active_path = True
            elif link.origin_node_id == warehouse_id:
                is_active_path = True

            link_status = "active" if is_active_path else (
                "disabled" if link.origin_node_id == primary_source_id and not port_a_active else "standby"
            )

            orig = node_map.get(link.origin_node_id)
            dest = node_map.get(link.destination_node_id)

            serialized_links.append({
                "id": link.id,
                "origin_id": link.origin_node_id,
                "destination_id": link.destination_node_id,
                "origin_name": orig.name if orig else link.origin_node_id,
                "destination_name": dest.name if dest else link.destination_node_id,
                "distance_km": link.distance_km,
                "toll_cost": link.toll_cost,
                "freight_rate": link.freight_rate_per_unit,
                "transit_days": link.transit_days,
                "capacity": link.max_units_per_day,
                "is_alternate": link.is_alternate,
                "is_active_path": is_active_path,
                "status": link_status,
            })

        return {
            "algorithm": "Multi-Criteria Shortest & Cost-Optimal Highway Routing",
            "port_a_active": port_a_active,
            "port_b_active": port_b_active,
            "primary_route": {
                "is_available": primary_path_valid,
                "path_nodes": [node_map[nid].name for nid in primary_path if nid in node_map],
                "path_node_ids": primary_path,
                "distance_km": primary_distance,
                "toll_cost": primary_tolls,
                "lead_time_days": primary_lead_time,
                "status": "OPERATIONAL" if primary_path_valid else "SEVERED_BY_INCIDENT",
            },
            "alternate_route": {
                "is_available": alternate_path_valid,
                "path_nodes": [node_map[nid].name for nid in alternate_path if nid in node_map],
                "path_node_ids": alternate_path,
                "distance_km": alternate_distance,
                "toll_cost": alternate_tolls,
                "lead_time_days": alternate_lead_time,
                "status": "ACTIVE_RECOMMENDED" if not port_a_active and alternate_path_valid else "STANDBY_RESERVE",
            },
            "distribution_routes": distribution_paths,
            "financial_loss_matrix": {
                "do_nothing": {
                    "unmet_demand_cartons": unmet_cartons_do_nothing,
                    "first_stockout_day": 5,
                    "shortage_penalty_usd": shortage_loss_do_nothing,
                    "facility_downtime_usd": facility_downtime_loss,
                    "total_loss_usd": total_do_nothing_loss,
                },
                "mitigated_reroute": {
                    "unmet_demand_cartons": unmet_cartons_mitigated,
                    "first_stockout_day": None,
                    "rerouted_cartons": rerouted_units,
                    "setup_cost_usd": setup_cost,
                    "freight_premium_usd": freight_premium,
                    "toll_expenses_usd": total_tolls_mitigated,
                    "total_cost_usd": total_mitigation_cost,
                },
                "tradeoff_delta": {
                    "net_financial_savings_usd": net_savings,
                    "cartons_saved": unmet_cartons_do_nothing,
                    "patient_stockout_days_prevented": 6,
                    "benefit_cost_ratio": roi_ratio,
                    "verdict": (
                        f"Contingency reroute avoids ${net_savings:,.0f} in critical stockout losses "
                        f"at an operational cost of ${total_mitigation_cost:,.0f} ({roi_ratio}x ROI)."
                    ),
                },
            },
            "map_nodes": serialized_nodes,
            "map_links": serialized_links,
        }


# Global singleton instance
daa_engine = DaaRoutingEngine()
