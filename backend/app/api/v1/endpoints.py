from fastapi import APIRouter, HTTPException, Response, Query
from fastapi.responses import PlainTextResponse, HTMLResponse
import subprocess
import sys
from typing import List, Dict, Any, Optional

from backend.app.schemas.schemas import (
    DatasetSchema,
    SimulateRequest,
    CompareRequest,
    IncidentScenarioSchema,
    MitigationOptionSchema,
    NodeSchema,
)
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
)
from backend.app.services.simulation_engine import SimulationEngine
from backend.app.services.dependency_service import DependencyService
from backend.app.services.comparison_service import ComparisonService
from backend.app.services.import_export_service import ImportExportService, CSV_TEMPLATES
from backend.app.services.siem_service import siem_service
from backend.app.services.daa_routing_service import daa_engine
from backend.app.data.synthetic_demo import get_synthetic_demo_data
from backend.app.data.custom_scenario import get_custom_network_scenario

router = APIRouter()


def schema_to_domain(ds: DatasetSchema):
    nodes = [Node(**n.model_dump()) for n in ds.nodes]
    products = [Product(**p.model_dump()) for p in ds.products]
    links = [PhysicalLink(**l.model_dump()) for l in ds.links]
    dependencies = [ServiceDependency(**d.model_dump()) for d in ds.dependencies]
    inventory = [InventoryPosition(**i.model_dump()) for i in ds.inventory]
    supply = [SupplyProfile(**s.model_dump()) for s in ds.supply_profiles]
    demand = [DemandProfile(**dm.model_dump()) for dm in ds.demand_profiles]
    return nodes, products, links, dependencies, inventory, supply, demand


@router.get("/demo")
def get_demo_dataset():
    """
    Returns pre-loaded synthetic demo dataset based on the JNPT 2017 case study.
    """
    data = get_synthetic_demo_data()
    return {
        "dataset": {
            "nodes": [n.__dict__ for n in data["nodes"]],
            "products": [p.__dict__ for p in data["products"]],
            "links": [l.__dict__ for l in data["links"]],
            "dependencies": [d.__dict__ for d in data["dependencies"]],
            "inventory": [i.__dict__ for i in data["inventory"]],
            "supply_profiles": [s.__dict__ for s in data["supply_profiles"]],
            "demand_profiles": [dp.__dict__ for dp in data["demand_profiles"]],
        },
        "scenario": data["scenario"].__dict__,
        "mitigations": [m.__dict__ for m in data["mitigations"]],
    }


@router.post("/validate")
def validate_model(dataset: DatasetSchema):
    """
    Validates graph connectivity, physical DAG constraints, and referential integrity.
    """
    nodes, products, links, dependencies, inventory, supply, demand = schema_to_domain(dataset)
    dep_service = DependencyService(nodes, links, dependencies)
    is_dag, cycles = dep_service.validate_physical_dag()

    errors = []
    warnings = []

    if not is_dag:
        errors.append({
            "code": "PHYSICAL_GRAPH_CYCLE",
            "message": f"Cycle detected in physical flow graph: {cycles}",
        })

    node_ids = {n.id for n in nodes}
    prod_ids = {p.id for p in products}

    for l in links:
        if l.origin_node_id not in node_ids:
            errors.append({"code": "REFERENCE_NOT_FOUND", "message": f"Link {l.id} origin node {l.origin_node_id} not found."})
        if l.destination_node_id not in node_ids:
            errors.append({"code": "REFERENCE_NOT_FOUND", "message": f"Link {l.id} destination node {l.destination_node_id} not found."})
        if l.product_id not in prod_ids:
            errors.append({"code": "REFERENCE_NOT_FOUND", "message": f"Link {l.id} product {l.product_id} not found."})

    for d in dependencies:
        if d.service_node_id not in node_ids:
            errors.append({"code": "REFERENCE_NOT_FOUND", "message": f"Dependency service node {d.service_node_id} not found."})
        if d.dependent_node_id not in node_ids:
            errors.append({"code": "REFERENCE_NOT_FOUND", "message": f"Dependency dependent node {d.dependent_node_id} not found."})

    return {
        "valid": len(errors) == 0,
        "is_dag": is_dag,
        "cycles": cycles,
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "node_count": len(nodes),
            "product_count": len(products),
            "link_count": len(links),
            "dependency_count": len(dependencies),
        },
    }


@router.post("/scenarios/trace")
def trace_impact(req: SimulateRequest):
    """
    Performs downstream graph traversal from affected node.
    """
    nodes, products, links, dependencies, _, _, _ = schema_to_domain(req.dataset)
    dep_service = DependencyService(nodes, links, dependencies)
    scen = IncidentScenario(**req.scenario.model_dump())
    
    # Check reachable downstream
    trace = dep_service.trace_downstream_reachability(scen.target_node_id)
    impact_map_day1 = dep_service.propagate_service_impact(scen, day=scen.start_day)

    return {
        "target_node_id": scen.target_node_id,
        "downstream_reached": trace,
        "impact_factors_on_start_day": impact_map_day1,
    }


@router.post("/scenarios/simulate")
def simulate_scenario(req: SimulateRequest):
    """
    Runs deterministic discrete daily simulation and returns full summary and daily breakdown.
    """
    nodes, products, links, dependencies, inventory, supply, demand = schema_to_domain(req.dataset)
    engine = SimulationEngine(nodes, products, links, dependencies, inventory, supply, demand)
    scen = IncidentScenario(**req.scenario.model_dump())
    mits = [MitigationOption(**m.model_dump()) for m in req.mitigations]

    summary = engine.run(scen, mits, req.horizon_days)

    return {
        "run_id": summary.run_id,
        "input_hash": summary.input_hash,
        "engine_version": summary.engine_version,
        "horizon_days": summary.horizon_days,
        "kpis": {
            "total_demand_units": summary.total_demand_units,
            "fulfilled_units": summary.fulfilled_units,
            "unmet_units": summary.unmet_units,
            "fill_rate": summary.fill_rate,
            "first_shortage_day": summary.first_shortage_day,
            "ending_stock": summary.ending_stock,
            "in_transit_units": summary.in_transit_units,
            "overflow_units": summary.overflow_units,
            "total_response_cost": summary.total_response_cost,
            "cost_is_complete": summary.cost_is_complete,
        },
        "assumptions": summary.assumptions_summary,
        "impacted_nodes": summary.impacted_nodes,
        "daily_rows": [r.__dict__ for r in summary.daily_rows],
        "events": [e.__dict__ for e in summary.events],
    }


@router.post("/scenarios/compare")
def compare_scenarios(req: CompareRequest):
    """
    Runs side-by-side comparison across baseline, do-nothing, options, and combined protocol.
    """
    nodes, products, links, dependencies, inventory, supply, demand = schema_to_domain(req.dataset)
    engine = SimulationEngine(nodes, products, links, dependencies, inventory, supply, demand)
    comparator = ComparisonService(engine)

    scen = IncidentScenario(**req.scenario.model_dump())
    mits = [MitigationOption(**m.model_dump()) for m in req.mitigations]

    comp_result = comparator.compare_scenarios(scen, mits, req.horizon_days)
    return comp_result


@router.get("/templates/{template_name}")
def download_template(template_name: str):
    """
    Downloads CSV template by name.
    """
    try:
        content = ImportExportService.get_template(template_name)
        return PlainTextResponse(content, media_type="text/csv", headers={
            "Content-Disposition": f"attachment; filename={template_name}"
        })
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/templates")
def list_templates():
    return list(CSV_TEMPLATES.keys())


@router.post("/export/csv")
def export_csv(req: SimulateRequest):
    """
    Exports daily result rows as formula-safe CSV.
    """
    nodes, products, links, dependencies, inventory, supply, demand = schema_to_domain(req.dataset)
    engine = SimulationEngine(nodes, products, links, dependencies, inventory, supply, demand)
    scen = IncidentScenario(**req.scenario.model_dump())
    mits = [MitigationOption(**m.model_dump()) for m in req.mitigations]

    summary = engine.run(scen, mits, req.horizon_days)
    csv_text = ImportExportService.export_daily_metrics_csv(summary)

    return PlainTextResponse(
        csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cyberchain_results_{summary.input_hash[:8]}.csv"}
    )


@router.get("/golden-tests")
def run_golden_tests():
    """
    Executes the golden test suite and returns live verification proofs.
    """
    cmd = [sys.executable, "-m", "pytest", "backend/tests/test_golden_cases.py", "-v"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "success": proc.returncode == 0,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


@router.get("/custom-scenario")
def get_custom_scenario():
    """
    Returns the user's custom multi-echelon network scenario:
    - 2 Ports (Port A & Port B)
    - 1 Warehouse (Warehouse X)
    - 2 Hospitals (Hospital M & Hospital N)
    - 1 Central Cloud & TOS Data Center
    """
    nodes, links, deps, invs, supply, demand, incident, mitigations = get_custom_network_scenario()
    product = Product(
        id="prod-critical-meds",
        sku="MED-ICU-CRIT",
        name="Critical Injectable Anesthetics & Antibiotics",
        unit_name="cartons",
        is_critical=True,
    )
    return {
        "dataset": {
            "nodes": [n.__dict__ for n in nodes],
            "products": [product.__dict__],
            "links": [l.__dict__ for l in links],
            "dependencies": [d.__dict__ for d in deps],
            "inventory": [i.__dict__ for i in invs],
            "supply_profiles": [s.__dict__ for s in supply],
            "demand_profiles": [dp.__dict__ for dp in demand],
        },
        "scenario": incident.__dict__,
        "mitigations": [m.__dict__ for m in mitigations],
    }


@router.get("/siem/telemetry")
def get_siem_telemetry(
    attack_scenario: str = Query("normal", description="'normal', 'ransomware', 'ddos', 'credential_stuffing'"),
    count: int = Query(15, ge=5, le=50)
):
    """
    Generates Data Center server logs and executes IsolationForest ML anomaly detection.
    """
    return siem_service.generate_telemetry_batch(
        service_node_id="node-datacenter-tos",
        attack_scenario=attack_scenario,
        count=count
    )


@router.get("/daa/routes")
def get_daa_routes(
    port_a_active: bool = Query(True, description="Whether Port A is online"),
    port_b_active: bool = Query(True, description="Whether Port B is online"),
    urgency_weight: float = Query(1.0, ge=0.5, le=3.0),
    shortage_penalty: float = Query(150.0, ge=10.0, le=1000.0)
):
    """
    Executes DAA Dijkstra minimal-cost route finding on the physical network.
    Calculates primary vs alternate routes, tolls, lead time, and total loss of doing nothing vs mitigating.
    """
    return daa_engine.evaluate_routes(
        port_a_active=port_a_active,
        port_b_active=port_b_active,
        demand_urgency_weight=urgency_weight,
        shortage_penalty_per_unit=shortage_penalty,
    )


@router.get("/routing/osrm")
def get_road_route(
    orig_lat: float = Query(...),
    orig_lon: float = Query(...),
    dest_lat: float = Query(...),
    dest_lon: float = Query(...)
):
    """
    Fetches real driving road geometry from OpenStreetMap OSRM routing engine.
    Returns array of [lat, lon] coordinates adhering to real highway road networks.
    """
    import urllib.request
    import json

    cache_key = f"{round(orig_lat, 4)},{round(orig_lon, 4)}-{round(dest_lat, 4)},{round(dest_lon, 4)}"
    if not hasattr(get_road_route, "_cache"):
        get_road_route._cache = {}

    if cache_key in get_road_route._cache:
        return {"coordinates": get_road_route._cache[cache_key], "calibrated": True}

    url = f"https://router.project-osrm.org/route/v1/driving/{orig_lon},{orig_lat};{dest_lon},{dest_lat}?overview=full&geometries=geojson"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AntigravitySupplyChain/1.0"})
        with urllib.request.urlopen(req, timeout=4) as response:
            data = json.loads(response.read().decode())
            if data.get("code") == "Ok" and data.get("routes"):
                # GeoJSON coordinates are [lon, lat] -> convert to [lat, lon] for Leaflet
                coords = [[pt[1], pt[0]] for pt in data["routes"][0]["geometry"]["coordinates"]]
                get_road_route._cache[cache_key] = coords
                return {"coordinates": coords, "calibrated": True, "distance_km": round(data["routes"][0]["distance"] / 1000.0, 1)}
    except Exception:
        pass

    # Fallback to straight line if offline or timed out
    fallback = [[orig_lat, orig_lon], [dest_lat, dest_lon]]
    return {"coordinates": fallback, "calibrated": False}

