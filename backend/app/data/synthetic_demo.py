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
    NodeType,
    Criticality,
    SourceStatus,
    ActionType,
    MitigationCombineMode,
    CapacityMode,
)


def get_synthetic_demo_data():
    nodes = [
        Node(
            id="digital-tos-booking",
            name="JNPT Gateway Terminal Operating System (TOS)",
            node_type=NodeType.DIGITAL_SERVICE,
            criticality=Criticality.CRITICAL,
            location_text="Navi Mumbai Digital DC",
            region_code="IN-MH",
            source_status=SourceStatus.HYPOTHETICAL,
            notes="EDI booking gateway, automated gate pass clearance, and container tracking system.",
        ),
        Node(
            id="port-jnpt-terminal",
            name="Jawaharlal Nehru Port Trust (JNPT Gateway Terminal)",
            node_type=NodeType.TERMINAL,
            criticality=Criticality.CRITICAL,
            location_text="Nhava Sheva, Maharashtra",
            region_code="IN-MH",
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="Primary container terminal handling 60% of Western India pharmaceutical sea freight.",
        ),
        Node(
            id="port-hazira-alt",
            name="Hazira Container Terminal (Secondary Alternate)",
            node_type=NodeType.PORT,
            criticality=Criticality.MEDIUM,
            location_text="Surat, Gujarat",
            region_code="IN-GJ",
            source_status=SourceStatus.SYNTHETIC,
            notes="Designated secondary bypass terminal with independent highway/rail drayage.",
        ),
        Node(
            id="wh-mumbai-central",
            name="Central Distribution Hub (Bhiwandi / Mumbai)",
            node_type=NodeType.WAREHOUSE,
            criticality=Criticality.CRITICAL,
            location_text="Bhiwandi, Maharashtra",
            region_code="IN-MH",
            source_status=SourceStatus.SYNTHETIC,
            notes="Central cold-chain medicine depot fulfilling urgent hospital supply quotas.",
        ),
        Node(
            id="hosp-apex-demand",
            name="Apex Regional Healthcare Network",
            node_type=NodeType.HOSPITAL,
            criticality=Criticality.CRITICAL,
            location_text="Mumbai Metropolitan Region",
            region_code="IN-MH",
            source_status=SourceStatus.SYNTHETIC,
            notes="Consortium of 14 hospitals treating inpatient critical care patients.",
        ),
    ]

    products = [
        Product(
            id="prod-med1",
            sku="MED-CRIT-01",
            name="Ceftriaxone & Meropenem IV Antibiotics",
            unit_name="cartons",
            is_critical=True,
            notes="Broad-spectrum hospital IV antibiotic for acute surgical and ICU sepsis management.",
        ),
    ]

    # Links:
    # 1. JNPT terminal to Central Hub (normal capacity 900 cartons/day, instant drayage/daily arrival)
    # 2. Hazira port to Central Hub (alternate bypass link, 400 cartons/day)
    # 3. Central Hub to Apex Hospital (downstream link)
    links = [
        PhysicalLink(
            id="link-jnpt-hub",
            origin_node_id="port-jnpt-terminal",
            destination_node_id="wh-mumbai-central",
            product_id="prod-med1",
            max_units_per_day=900,
            transit_days=0,
            priority=1,
            baseline_enabled=True,
            is_alternate=False,
            cost_per_unit=8.0,
            notes="Direct container drayage corridor JNPT to Central Hub.",
        ),
        PhysicalLink(
            id="link-hazira-hub",
            origin_node_id="port-hazira-alt",
            destination_node_id="wh-mumbai-central",
            product_id="prod-med1",
            max_units_per_day=400,
            transit_days=0,
            priority=2,
            baseline_enabled=False,
            is_alternate=True,
            cost_per_unit=15.0,
            notes="Contingency expressway trucking from Hazira to Central Hub.",
        ),
    ]

    dependencies = [
        ServiceDependency(
            id="dep-booking-jnpt",
            service_node_id="digital-tos-booking",
            dependent_node_id="port-jnpt-terminal",
            dependency_type="critical_tos_gateway",
            failure_mode="gate_clearance_paralysis",
            remaining_capacity_factor=0.3333333333,
            source_status=SourceStatus.CONFIRMED_PUBLIC,
            notes="When booking and gate system is offline, terminal throughput is throttled to 33% (300 cartons/day).",
        )
    ]

    inventory = [
        InventoryPosition(
            node_id="wh-mumbai-central",
            product_id="prod-med1",
            on_hand_units=5000,
            storage_capacity_units=15000,
            as_of_day=1,
        ),
    ]

    # Supply profiles:
    # JNPT has supply profile of 900/day
    supply_profiles = [
        SupplyProfile(
            node_id="wh-mumbai-central",
            product_id="prod-med1",
            units_per_day=900,
            active_from_day=1,
            active_to_day=30,
            notes="Inbound replenishment flow arriving into distribution hub.",
        )
    ]

    demand_profiles = [
        DemandProfile(
            node_id="wh-mumbai-central",
            product_id="prod-med1",
            units_per_day=900,
            active_from_day=1,
            active_to_day=30,
            notes="Hospital daily consumption demand fulfilled by the central hub.",
        )
    ]

    # Pre-configured baseline incident scenario matching brief worked example
    scenario = IncidentScenario(
        id="scen-jnpt-notpetya",
        name="Maersk JNPT 2017 Terminal Booking Outage",
        event_type="booking_system_unavailable",
        target_node_id="wh-mumbai-central",
        status=SourceStatus.HYPOTHETICAL,
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
        source_title="UNCTAD Case Study 16: JNPT India Terminal Cyber Incident",
        source_url="https://resilientmaritimelogistics.unctad.org/es/node/311",
        source_excerpt="A cyberattack disrupted terminal operations at JNPT; gates stalled, containers piled up inland, and alternative routing was evaluated.",
        confirmed_by_user=True,
        assumptions_note="Synthetic demo assumption: Terminal disruption reduces inbound replenishment from 900 to 300 cartons/day for 10 days.",
    )

    mitigations = [
        MitigationOption(
            id="mit-alternate-port",
            scenario_id="scen-jnpt-notpetya",
            name="Alternate Port Reroute (+400/day from Day 3)",
            action_type=ActionType.CAPACITY_OVERRIDE,
            start_day=3,
            target_node_id="wh-mumbai-central",
            capacity_effect=MitigationCombineMode.ADD,
            capacity_value=400,
            setup_cost=5000.0,
            variable_cost_per_unit=15.0,
            assumption_note="Diverts vessel cargo to Hazira port, adding +400 cartons/day from Day 3.",
        ),
        MitigationOption(
            id="mit-manual-fallback",
            scenario_id="scen-jnpt-notpetya",
            name="Manual Fallback (raises throughput to 450/day from Day 4)",
            action_type=ActionType.CAPACITY_OVERRIDE,
            start_day=4,
            target_node_id="wh-mumbai-central",
            capacity_effect=MitigationCombineMode.REPLACE,
            capacity_value=450,
            setup_cost=2500.0,
            variable_cost_per_unit=6.0,
            assumption_note="Deploys port staff for manual paperwork, raising terminal throughput from 300 to 450 cartons/day from Day 4.",
        ),
    ]

    return {
        "nodes": nodes,
        "products": products,
        "links": links,
        "dependencies": dependencies,
        "inventory": inventory,
        "supply_profiles": supply_profiles,
        "demand_profiles": demand_profiles,
        "scenario": scenario,
        "mitigations": mitigations,
    }
