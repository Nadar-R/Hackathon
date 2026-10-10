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
    NodeType,
    Criticality,
    SourceStatus,
)
from backend.app.services.simulation_engine import SimulationEngine
from backend.app.services.dependency_service import DependencyService


def test_service_dependency_propagation():
    """Tests that an outage on a digital service impacts downstream operational node capacity."""
    booking_service = Node(
        id="digital-booking",
        name="Terminal Booking & TOS System",
        node_type=NodeType.DIGITAL_SERVICE,
        criticality=Criticality.HIGH,
    )
    port_terminal = Node(
        id="node-port",
        name="Container Terminal 1",
        node_type=NodeType.TERMINAL,
        criticality=Criticality.CRITICAL,
    )
    dest_node = Node(
        id="node-dest",
        name="Main Distribution Hub",
        node_type=NodeType.WAREHOUSE,
        criticality=Criticality.HIGH,
    )
    dep = ServiceDependency(
        id="dep-1",
        service_node_id="digital-booking",
        dependent_node_id="node-port",
        remaining_capacity_factor=0.3333333333,  # Leaves ~33% capacity
        source_status=SourceStatus.HYPOTHETICAL,
    )
    prod = Product(id="p1", sku="SKU-1", name="Product 1", unit_name="units")

    nodes = [booking_service, port_terminal, dest_node]
    links = [
        PhysicalLink(
            id="link-port-dest",
            origin_node_id="node-port",
            destination_node_id="node-dest",
            product_id="p1",
            max_units_per_day=900,
            transit_days=1,
            priority=1,
        )
    ]

    dep_service = DependencyService(nodes, links, [dep])
    incident = IncidentScenario(
        id="scen-cyber",
        name="Booking System Cyber Outage",
        event_type="ransomware",
        target_node_id="digital-booking",
        start_day=1,
        duration_days=5,
        remaining_capacity_factor=0.3333333333,
    )

    impact_map_day1 = dep_service.propagate_service_impact(incident, day=1)
    assert impact_map_day1["digital-booking"]["impacted"] is True
    assert impact_map_day1["node-port"]["impacted"] is True
    assert abs(impact_map_day1["node-port"]["factor"] - 0.3333333333) < 1e-5

    # Day 6 is outside duration (1 to 5)
    impact_map_day6 = dep_service.propagate_service_impact(incident, day=6)
    assert impact_map_day6["node-port"]["impacted"] is False
    assert impact_map_day6["node-port"]["factor"] == 1.0


def test_physical_dag_cycle_detection():
    """Tests that physical flow graph cycles are accurately detected."""
    node_a = Node(id="A", name="Node A", node_type=NodeType.SUPPLIER)
    node_b = Node(id="B", name="Node B", node_type=NodeType.WAREHOUSE)
    node_c = Node(id="C", name="Node C", node_type=NodeType.PORT)

    prod = Product(id="p1", sku="SKU-1", name="Product 1", unit_name="units")

    # A -> B -> C -> A (cycle!)
    cyclic_links = [
        PhysicalLink(id="l1", origin_node_id="A", destination_node_id="B", product_id="p1", max_units_per_day=100),
        PhysicalLink(id="l2", origin_node_id="B", destination_node_id="C", product_id="p1", max_units_per_day=100),
        PhysicalLink(id="l3", origin_node_id="C", destination_node_id="A", product_id="p1", max_units_per_day=100),
    ]

    dep_service = DependencyService([node_a, node_b, node_c], cyclic_links, [])
    is_dag, cycles = dep_service.validate_physical_dag()
    assert is_dag is False
    assert len(cycles) > 0


def test_transit_delay_and_in_transit_pipeline():
    """Tests transit_days delay where dispatch on day 1 arrives on day 3 with transit_days=2."""
    orig = Node(id="orig", name="Origin Factory", node_type=NodeType.MANUFACTURER)
    dest = Node(id="dest", name="Destination Hospital", node_type=NodeType.HOSPITAL)
    prod = Product(id="p1", sku="SKU-1", name="Product 1", unit_name="units")

    inv = [
        InventoryPosition(node_id="orig", product_id="p1", on_hand_units=1000),
        InventoryPosition(node_id="dest", product_id="p1", on_hand_units=0),
    ]
    links = [
        PhysicalLink(
            id="link-truck",
            origin_node_id="orig",
            destination_node_id="dest",
            product_id="p1",
            max_units_per_day=500,
            transit_days=2,  # Dispatched day 1 -> arrives day 3
            priority=1,
        )
    ]
    demand = [
        DemandProfile(node_id="dest", product_id="p1", units_per_day=200, active_from_day=1, active_to_day=5)
    ]

    engine = SimulationEngine([orig, dest], [prod], links, [], inv, [], demand)
    dummy_scen = IncidentScenario(id="s0", name="None", event_type="none", target_node_id="orig", start_day=99, duration_days=1)
    res = engine.run(dummy_scen, horizon_days=4)

    # On day 1: dest has 0 stock, demand 200 -> unmet 200. Dispatch 500 from orig.
    # On day 2: dest has 0 stock, demand 200 -> unmet 200.
    # On day 3: shipment of 500 arrives! Stock 500, demand 200 -> fulfilled 200, ending 300.
    # On day 4: stock 300, demand 200 -> fulfilled 200, ending 100.
    dest_rows = [r for r in res.daily_rows if r.node_id == "dest"]
    day1 = [r for r in dest_rows if r.day == 1][0]
    day2 = [r for r in dest_rows if r.day == 2][0]
    day3 = [r for r in dest_rows if r.day == 3][0]

    assert day1.unmet == 200
    assert day2.unmet == 200
    assert day3.arrivals_accepted == 500
    assert day3.fulfilled == 200
    assert day3.unmet == 0
    assert day3.ending_inventory == 300
