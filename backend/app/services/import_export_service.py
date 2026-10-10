import csv
import io
from typing import List, Dict, Any, Tuple, Optional
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


def sanitize_csv_cell(val: Any) -> str:
    """
    Prevents CSV Formula Injection (CWE-1236 / OWASP)
    If a string starts with =, +, -, @, prefix with a single quote.
    """
    if val is None:
        return ""
    s = str(val)
    if len(s) > 0 and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s


CSV_TEMPLATES = {
    "nodes.csv": [
        "id,name,node_type,criticality,location_text,region_code,is_active,source_status,notes",
        "port-jnpt-terminal,JNPT Gateway Terminal,terminal,critical,Nhava Sheva,IN-MH,true,confirmed_public,Primary Western India container terminal",
        "digital-tos-booking,TOS Booking Gateway,digital_service,critical,Navi Mumbai,IN-MH,true,synthetic,EDI gate clearance and container management",
        "wh-mumbai-central,Bhiwandi Pharma DC,warehouse,high,Bhiwandi,IN-MH,true,synthetic,Central distribution warehouse",
    ],
    "products.csv": [
        "id,sku,name,unit_name,is_critical,notes",
        "prod-med1,MED-CRIT-01,Ceftriaxone IV Antibiotic,cartons,true,ICU and acute sepsis medicine",
        "prod-insulin,MED-INS-02,Insulin Glargine,vials,false,Daily glycemic therapy",
    ],
    "physical_links.csv": [
        "id,origin_node_id,destination_node_id,product_id,max_units_per_day,transit_days,priority,baseline_enabled,is_alternate,cost_per_unit,notes",
        "link-jnpt-hub,port-jnpt-terminal,wh-mumbai-central,prod-med1,900,1,1,true,false,8.0,Direct container corridor",
    ],
    "service_dependencies.csv": [
        "id,service_node_id,dependent_node_id,dependency_type,failure_mode,remaining_capacity_factor,source_status,notes",
        "dep-booking-jnpt,digital-tos-booking,port-jnpt-terminal,critical_tos,gate_clearance_paralysis,0.33,confirmed_public,Booking failure reduces terminal throughput to 33%",
    ],
    "inventory.csv": [
        "node_id,product_id,on_hand_units,storage_capacity_units,as_of_day",
        "wh-mumbai-central,prod-med1,5000,15000,1",
    ],
    "supply_profiles.csv": [
        "node_id,product_id,units_per_day,active_from_day,active_to_day,notes",
        "port-jnpt-terminal,prod-med1,900,1,30,Normal port container offloading",
    ],
    "demand_profiles.csv": [
        "node_id,product_id,units_per_day,active_from_day,active_to_day,notes",
        "wh-mumbai-central,prod-med1,900,1,30,Daily downstream hospital dispatch requirement",
    ],
    "incidents.csv": [
        "id,name,event_type,target_node_id,status,start_day,duration_days,remaining_capacity_factor,source_title,source_url,source_excerpt,confirmed_by_user,assumptions_note",
        "scen-1,Maersk JNPT TOS Outage,booking_outage,port-jnpt-terminal,hypothetical,1,10,0.33,UNCTAD Case Study 16,https://resilientmaritimelogistics.unctad.org/es/node/311,Terminal stalled,true,Synthetic 300/day throughput for 10 days",
    ],
}


class ImportExportService:
    @staticmethod
    def get_template(template_name: str) -> str:
        if template_name not in CSV_TEMPLATES:
            raise ValueError(f"Template {template_name} not found. Available: {list(CSV_TEMPLATES.keys())}")
        return "\n".join(CSV_TEMPLATES[template_name])

    @staticmethod
    def parse_nodes_csv(content: str) -> Tuple[List[Node], List[str]]:
        reader = csv.DictReader(io.StringIO(content))
        nodes: List[Node] = []
        errors: List[str] = []
        seen_ids = set()

        for row_idx, row in enumerate(reader, start=2):
            node_id = row.get("id", "").strip()
            name = row.get("name", "").strip()
            raw_type = row.get("node_type", "").strip().lower()

            if not node_id:
                errors.append(f"Row {row_idx}: 'id' is required.")
                continue
            if node_id in seen_ids:
                errors.append(f"Row {row_idx}: Duplicate node id '{node_id}'.")
                continue
            seen_ids.add(node_id)

            if not name:
                errors.append(f"Row {row_idx}: 'name' is required.")
                continue

            try:
                node_type = NodeType(raw_type)
            except ValueError:
                errors.append(f"Row {row_idx}: Invalid node_type '{raw_type}'. Allowed: {[t.value for t in NodeType]}")
                continue

            raw_crit = row.get("criticality", "medium").strip().lower()
            try:
                criticality = Criticality(raw_crit)
            except ValueError:
                criticality = Criticality.MEDIUM

            raw_status = row.get("source_status", "synthetic").strip().lower()
            try:
                source_status = SourceStatus(raw_status)
            except ValueError:
                source_status = SourceStatus.SYNTHETIC

            is_active = row.get("is_active", "true").strip().lower() in ("true", "1", "yes")

            nodes.append(Node(
                id=node_id,
                name=name,
                node_type=node_type,
                criticality=criticality,
                location_text=row.get("location_text"),
                region_code=row.get("region_code"),
                is_active=is_active,
                source_status=source_status,
                notes=row.get("notes"),
            ))

        return nodes, errors

    @staticmethod
    def export_daily_metrics_csv(summary) -> str:
        """
        Exports daily metrics table to CSV with formula injection sanitization.
        """
        output = io.StringIO()
        writer = csv.writer(output)
        headers = [
            "Day",
            "Node ID",
            "Product ID",
            "Opening Inventory",
            "Supply Added",
            "Arrivals Due",
            "Arrivals Accepted",
            "Demand",
            "Fulfilled",
            "Unmet Demand",
            "Outbound Dispatched",
            "Storage Overflow",
            "Ending Inventory",
            "In Transit Units",
            "Effective Capacity Factor",
            "Impact Notes",
        ]
        writer.writerow(headers)

        for r in summary.daily_rows:
            writer.writerow([
                r.day,
                sanitize_csv_cell(r.node_id),
                sanitize_csv_cell(r.product_id),
                r.opening_inventory,
                r.supply_added,
                r.arrivals_due,
                r.arrivals_accepted,
                r.demand,
                r.fulfilled,
                r.unmet,
                r.outbound_dispatched,
                r.overflow_removed,
                r.ending_inventory,
                r.in_transit_units,
                f"{r.effective_capacity_factor:.2f}",
                sanitize_csv_cell("; ".join(r.impact_reasons)),
            ])

        return output.getvalue()
