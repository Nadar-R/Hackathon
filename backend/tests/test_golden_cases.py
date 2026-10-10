import pytest
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
from backend.app.services.simulation_engine import SimulationEngine


def create_base_fixture(starting_stock=5000, daily_demand=900, normal_supply=900):
    dest_node = Node(
        id="node-dest",
        name="Central Hospital",
        node_type=NodeType.HOSPITAL,
        criticality=Criticality.CRITICAL,
    )
    product = Product(
        id="prod-med1",
        sku="MED-CRIT-01",
        name="Critical Antibiotic",
        unit_name="vials",
        is_critical=True,
    )
    inv = [
        InventoryPosition(
            node_id="node-dest",
            product_id="prod-med1",
            on_hand_units=starting_stock,
        )
    ]
    # Supply directly to node (e.g. from port/terminal)
    supply = [
        SupplyProfile(
            node_id="node-dest",
            product_id="prod-med1",
            units_per_day=normal_supply,
            active_from_day=1,
            active_to_day=10,
        )
    ]
    demand = [
        DemandProfile(
            node_id="node-dest",
            product_id="prod-med1",
            units_per_day=daily_demand,
            active_from_day=1,
            active_to_day=10,
        )
    ]
    return [dest_node], [product], inv, supply, demand


def test_g1_no_incident():
    """G1: No incident -> 900 inflow/day, 900 demand/day, ending 5000, 0 unmet, no stockout"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    # Scenario outside horizon
    scenario = IncidentScenario(
        id="scen-none",
        name="No Outage",
        event_type="none",
        target_node_id="node-dest",
        start_day=99,
        duration_days=1,
        remaining_capacity_factor=1.0,
    )
    res = engine.run(scenario, horizon_days=10)
    assert res.first_shortage_day is None
    assert res.unmet_units == 0
    assert res.ending_stock == 5000


def test_g2_do_nothing():
    """G2: 300 inflow/day for 10 days -> first stockout day 9, unmet 1000, ending 0"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g2",
        name="Terminal Outage",
        event_type="cyber_outage",
        target_node_id="node-dest",
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
    )
    res = engine.run(scenario, horizon_days=10)
    assert res.first_shortage_day == 9
    assert res.unmet_units == 1000
    assert res.ending_stock == 0


def test_g3_alternate_port():
    """G3: G2 + Alternate port adding 400/day from day 3 -> ending 2200, unmet 0, no stockout"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g3",
        name="Terminal Outage",
        event_type="cyber_outage",
        target_node_id="node-dest",
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
    )
    mitigations = [
        MitigationOption(
            id="mit-alt-port",
            scenario_id="scen-g3",
            name="Alternate Port Reroute",
            action_type=ActionType.CAPACITY_OVERRIDE,
            target_node_id="node-dest",
            start_day=3,
            capacity_effect=MitigationCombineMode.ADD,
            capacity_value=400,
            assumption_note="Secondary terminal adds 400/day",
        )
    ]
    res = engine.run(scenario, mitigations=mitigations, horizon_days=10)
    assert res.first_shortage_day is None
    assert res.unmet_units == 0
    assert res.ending_stock == 2200


def test_g4_manual_fallback():
    """G4: G2 + Manual fallback replacing 300 with 450/day from day 4 -> ending 50, unmet 0, no stockout"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g4",
        name="Terminal Outage",
        event_type="cyber_outage",
        target_node_id="node-dest",
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
    )
    mitigations = [
        MitigationOption(
            id="mit-manual",
            scenario_id="scen-g4",
            name="Manual Paper Fallback",
            action_type=ActionType.CAPACITY_OVERRIDE,
            target_node_id="node-dest",
            start_day=4,
            capacity_effect=MitigationCombineMode.REPLACE,
            capacity_value=450,
            assumption_note="Manual paperwork raises terminal processing to 450/day",
        )
    ]
    res = engine.run(scenario, mitigations=mitigations, horizon_days=10)
    assert res.first_shortage_day is None
    assert res.unmet_units == 0
    assert res.ending_stock == 50


def test_g5_combined():
    """G5: G2 + Both mitigations (replace with 450 on day 4 + add 400 from day 3) -> ending 3250, unmet 0"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g5",
        name="Terminal Outage",
        event_type="cyber_outage",
        target_node_id="node-dest",
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
    )
    mitigations = [
        MitigationOption(
            id="mit-alt-port",
            scenario_id="scen-g5",
            name="Alternate Port Reroute",
            action_type=ActionType.CAPACITY_OVERRIDE,
            target_node_id="node-dest",
            start_day=3,
            capacity_effect=MitigationCombineMode.ADD,
            capacity_value=400,
            assumption_note="Secondary terminal adds 400/day",
        ),
        MitigationOption(
            id="mit-manual",
            scenario_id="scen-g5",
            name="Manual Paper Fallback",
            action_type=ActionType.CAPACITY_OVERRIDE,
            target_node_id="node-dest",
            start_day=4,
            capacity_effect=MitigationCombineMode.REPLACE,
            capacity_value=450,
            assumption_note="Manual paperwork raises terminal processing to 450/day",
        ),
    ]
    res = engine.run(scenario, mitigations=mitigations, horizon_days=10)
    assert res.first_shortage_day is None
    assert res.unmet_units == 0
    assert res.ending_stock == 3250


def test_g6_starting_stock_zero():
    """G6: Starting stock 0, inflow 300, demand 900 -> Day 1 stockout, 6000 unmet, 0 ending stock"""
    nodes, prods, inv, supply, demand = create_base_fixture(starting_stock=0)
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g6",
        name="Terminal Outage Zero Stock",
        event_type="cyber_outage",
        target_node_id="node-dest",
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
    )
    res = engine.run(scenario, horizon_days=10)
    assert res.first_shortage_day == 1
    assert res.unmet_units == 6000
    assert res.ending_stock == 0


def test_g7_short_outage():
    """G7: Outage days 1-3 (300/day), then 900/day -> ending 3200, unmet 0, no stockout"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g7",
        name="Short Outage",
        event_type="cyber_outage",
        target_node_id="node-dest",
        start_day=1,
        duration_days=3,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
    )
    res = engine.run(scenario, horizon_days=10)
    assert res.first_shortage_day is None
    assert res.unmet_units == 0
    assert res.ending_stock == 3200


def test_g9_full_outage():
    """G9: Inflow 0 for 10 days -> first stockout day 6, unmet 4000, ending 0"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g9",
        name="Total Port Shutdown",
        event_type="ransomware",
        target_node_id="node-dest",
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=0,
    )
    res = engine.run(scenario, horizon_days=10)
    assert res.first_shortage_day == 6
    assert res.unmet_units == 4000
    assert res.ending_stock == 0


def test_g10_late_mitigation():
    """G10: G2 + Alternate port adding 400/day from day 9 only -> stockout day 10, unmet 200, ending 0"""
    nodes, prods, inv, supply, demand = create_base_fixture()
    engine = SimulationEngine(
        nodes=nodes,
        products=prods,
        links=[],
        dependencies=[],
        inventory=inv,
        supply_profiles=supply,
        demand_profiles=demand,
    )
    scenario = IncidentScenario(
        id="scen-g10",
        name="Terminal Outage",
        event_type="cyber_outage",
        target_node_id="node-dest",
        start_day=1,
        duration_days=10,
        capacity_mode=CapacityMode.ABSOLUTE,
        absolute_capacity_value=300,
    )
    mitigations = [
        MitigationOption(
            id="mit-late-alt",
            scenario_id="scen-g10",
            name="Late Alternate Port",
            action_type=ActionType.CAPACITY_OVERRIDE,
            target_node_id="node-dest",
            start_day=9,
            capacity_effect=MitigationCombineMode.ADD,
            capacity_value=400,
            assumption_note="Late alternate port from day 9",
        )
    ]
    res = engine.run(scenario, mitigations=mitigations, horizon_days=10)
    assert res.first_shortage_day == 10
    assert res.unmet_units == 200
    assert res.ending_stock == 0
