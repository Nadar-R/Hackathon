from typing import List, Tuple
from backend.app.core.domain import (
    Node,
    NodeType,
    Criticality,
    PhysicalLink,
    ServiceDependency,
    InventoryPosition,
    SupplyProfile,
    DemandProfile,
    IncidentScenario,
    MitigationOption,
    ActionType,
    SourceStatus,
    CapacityMode,
    MitigationCombineMode,
)


def get_custom_network_scenario() -> Tuple[
    List[Node],
    List[PhysicalLink],
    List[ServiceDependency],
    List[InventoryPosition],
    List[SupplyProfile],
    List[DemandProfile],
    IncidentScenario,
    List[MitigationOption],
]:
    """
    Returns the user's custom multi-echelon healthcare supply chain:
    - 2 Ports: Port A (Nhava Sheva) and Port B (Hazira Alternate)
    - 1 Warehouse: Warehouse X (Bhiwandi Distribution Depot)
    - 2 Hospitals: Hospital M (Apex Mumbai) and Hospital N (Ruby Pune)
    - 1 Data Center: Logistics Cloud & Terminal Operating System (TOS) DC
    """

    nodes = [
        Node(
            id="node-port-a",
            name="Nhava Sheva Gateway (Port A)",
            node_type=NodeType.PORT,
            criticality=Criticality.CRITICAL,
            location_text="Navi Mumbai, Maharashtra",
            region_code="IN-MH",
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="Primary sea container port handling 75% of regional pharmaceutical imports.",
            latitude=18.9499,
            longitude=72.9511,
            city="Mumbai",
        ),
        Node(
            id="node-port-b",
            name="Hazira Container Terminal (Port B)",
            node_type=NodeType.PORT,
            criticality=Criticality.HIGH,
            location_text="Surat / Hazira, Gujarat",
            region_code="IN-GJ",
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="Secondary deep-water alternate port 280km north, equipped with automated container cranes.",
            latitude=21.0963,
            longitude=72.6416,
            city="Surat",
        ),
        Node(
            id="node-warehouse-x",
            name="Bhiwandi Central Pharma Hub (Warehouse X)",
            node_type=NodeType.WAREHOUSE,
            criticality=Criticality.CRITICAL,
            location_text="Bhiwandi Logistics Corridor, Maharashtra",
            region_code="IN-MH",
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="Temperature-controlled buffer depot with 12,000 carton storage capacity.",
            latitude=19.2969,
            longitude=73.0631,
            city="Bhiwandi",
        ),
        Node(
            id="node-hospital-m",
            name="Apex Memorial Super-Speciality (Hospital M)",
            node_type=NodeType.HOSPITAL,
            criticality=Criticality.CRITICAL,
            location_text="Central Mumbai, Maharashtra",
            region_code="IN-MH",
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="Tertiary ICU and oncology referral hospital with 600 daily carton consumption.",
            latitude=19.0760,
            longitude=72.8777,
            city="Mumbai",
        ),
        Node(
            id="node-hospital-n",
            name="Ruby Regional Trauma Center (Hospital N)",
            node_type=NodeType.HOSPITAL,
            criticality=Criticality.HIGH,
            location_text="Pune East Corridor, Maharashtra",
            region_code="IN-MH",
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="District trauma center consuming 400 daily cartons of critical supplies.",
            latitude=18.5204,
            longitude=73.8567,
            city="Pune",
        ),
        Node(
            id="node-datacenter-tos",
            name="Central Cloud & TOS Data Center",
            node_type=NodeType.DIGITAL_SERVICE,
            criticality=Criticality.CRITICAL,
            location_text="BKC Tech District, Mumbai",
            region_code="IN-MH",
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="Central data center hosting Terminal Operating System (TOS), electronic gate passes, and EDI scheduling.",
            latitude=19.0657,
            longitude=72.8687,
            city="Mumbai",
        ),
    ]

    links = [
        # Primary Inbound Route: Port A -> Warehouse X
        PhysicalLink(
            id="link-porta-warehouse",
            origin_node_id="node-port-a",
            destination_node_id="node-warehouse-x",
            product_id="prod-critical-meds",
            max_units_per_day=1500,
            transit_days=1,
            priority=1,
            baseline_enabled=True,
            is_alternate=False,
            cost_per_unit=5.0,
            distance_km=48.0,
            toll_cost=25.0,
            freight_rate_per_unit=5.0,
            notes="Primary highway corridor via NH-348. Fast 1-day transit, $25 toll per truck batch.",
        ),
        # Contingency Alternate Route: Port B -> Warehouse X
        PhysicalLink(
            id="link-portb-warehouse",
            origin_node_id="node-port-b",
            destination_node_id="node-warehouse-x",
            product_id="prod-critical-meds",
            max_units_per_day=1200,
            transit_days=2,
            priority=2,
            baseline_enabled=False,
            is_alternate=True,
            cost_per_unit=18.0,
            distance_km=285.0,
            toll_cost=140.0,
            freight_rate_per_unit=18.0,
            notes="Alternate route via NH-48 corridor from Hazira. 2-day lead time, $140 highway tolls per truck batch.",
        ),
        # Outbound Delivery: Warehouse X -> Hospital M
        PhysicalLink(
            id="link-warehouse-hospm",
            origin_node_id="node-warehouse-x",
            destination_node_id="node-hospital-m",
            product_id="prod-critical-meds",
            max_units_per_day=800,
            transit_days=1,
            priority=1,
            baseline_enabled=True,
            is_alternate=False,
            cost_per_unit=4.0,
            distance_km=42.0,
            toll_cost=15.0,
            freight_rate_per_unit=4.0,
            notes="City arterial distribution to Hospital M.",
        ),
        # Outbound Delivery: Warehouse X -> Hospital N
        PhysicalLink(
            id="link-warehouse-hospn",
            origin_node_id="node-warehouse-x",
            destination_node_id="node-hospital-n",
            product_id="prod-critical-meds",
            max_units_per_day=600,
            transit_days=1,
            priority=1,
            baseline_enabled=True,
            is_alternate=False,
            cost_per_unit=10.0,
            distance_km=158.0,
            toll_cost=65.0,
            freight_rate_per_unit=10.0,
            notes="Interstate expressway delivery to Hospital N in Pune via Mumbai-Pune Expressway ($65 toll).",
        ),
    ]

    dependencies = [
        ServiceDependency(
            id="dep-dc-porta",
            service_node_id="node-datacenter-tos",
            dependent_node_id="node-port-a",
            dependency_type="tos_gate_api",
            failure_mode="capacity_degradation",
            remaining_capacity_factor=0.0,  # Total freeze on Port A if Data Center is down
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="Port A gate cranes and EDI clearance require live connection to Central TOS Data Center.",
        )
    ]

    inventory_positions = [
        InventoryPosition(
            node_id="node-port-a",
            product_id="prod-critical-meds",
            on_hand_units=0,
            storage_capacity_units=5000,
            as_of_day=1,
        ),
        InventoryPosition(
            node_id="node-port-b",
            product_id="prod-critical-meds",
            on_hand_units=0,
            storage_capacity_units=5000,
            as_of_day=1,
        ),
        InventoryPosition(
            node_id="node-warehouse-x",
            product_id="prod-critical-meds",
            on_hand_units=4000,
            storage_capacity_units=12000,
            as_of_day=1,
        ),
        InventoryPosition(
            node_id="node-hospital-m",
            product_id="prod-critical-meds",
            on_hand_units=600,
            storage_capacity_units=3000,
            as_of_day=1,
        ),
        InventoryPosition(
            node_id="node-hospital-n",
            product_id="prod-critical-meds",
            on_hand_units=400,
            storage_capacity_units=2000,
            as_of_day=1,
        ),
    ]

    supply_profiles = [
        SupplyProfile(
            node_id="node-port-a",
            product_id="prod-critical-meds",
            units_per_day=1000,
            active_from_day=1,
            active_to_day=90,
            notes="Normal container offloading rate at Port A: 1,000 cartons/day.",
        ),
        SupplyProfile(
            node_id="node-port-b",
            product_id="prod-critical-meds",
            units_per_day=800,
            active_from_day=1,
            active_to_day=90,
            notes="Available reserve berthing capacity at Port B: 800 cartons/day.",
        ),
    ]

    demand_profiles = [
        DemandProfile(
            node_id="node-hospital-m",
            product_id="prod-critical-meds",
            units_per_day=600,
            active_from_day=1,
            active_to_day=90,
            notes="Hospital M daily patient consumption: 600 cartons.",
        ),
        DemandProfile(
            node_id="node-hospital-n",
            product_id="prod-critical-meds",
            units_per_day=400,
            active_from_day=1,
            active_to_day=90,
            notes="Hospital N daily trauma consumption: 400 cartons.",
        ),
    ]

    # Baseline Outage on Data Center
    incident = IncidentScenario(
        id="scen-dc-ransomware",
        name="Data Center Ransomware / TOS API Lockout",
        event_type="cyber_ransomware",
        target_node_id="node-datacenter-tos",
        status=SourceStatus.HYPOTHETICAL,
        start_day=1,
        duration_days=10,
        remaining_capacity_factor=0.0,  # 100% outage on Data Center
        capacity_mode=CapacityMode.MULTIPLIER,
        source_title="SIEM Intrusion Telemetry Alert #SEC-2026-904",
        source_url="https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-0144",
        source_excerpt="Ransomware payload encrypted TOS booking database and message brokers.",
        assumptions_note="Attack on Data Center disables electronic gate passes at Port A, dropping throughput to 0 units/day.",
    )

    mitigations = [
        MitigationOption(
            id="mit-daa-portb-reroute",
            scenario_id="scen-dc-ransomware",
            name="Contingency Alternate Supply Route via Hazira",
            action_type=ActionType.ACTIVATE_LINK,
            start_day=2,
            end_day=10,
            target_link_id="link-portb-warehouse",
            target_node_id="node-port-b",
            capacity_effect=MitigationCombineMode.ADD,
            capacity_value=800,
            setup_cost=4500.0,
            variable_cost_per_unit=18.0,
            assumption_note="Optimal contingency reroute: Diverts container vessels to secondary terminal, routing via NH-48 with +1 day lead time.",
        )
    ]

    return (
        nodes,
        links,
        dependencies,
        inventory_positions,
        supply_profiles,
        demand_profiles,
        incident,
        mitigations,
    )
