from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
import hashlib
import json


class NodeType(str, Enum):
    SUPPLIER = "supplier"
    PORT = "port"
    TERMINAL = "terminal"
    CARRIER = "carrier"
    WAREHOUSE = "warehouse"
    MANUFACTURER = "manufacturer"
    RETAILER = "retailer"
    HOSPITAL = "hospital"
    CUSTOMER = "customer"
    DIGITAL_SERVICE = "digital_service"
    OTHER = "other"


class Criticality(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SourceStatus(str, Enum):
    SYNTHETIC = "synthetic"
    CONFIRMED_PUBLIC = "confirmed_public"
    REPORTED_UNCONFIRMED = "reported_unconfirmed"
    KNOWN_VULNERABILITY = "known_vulnerability"
    HYPOTHETICAL = "hypothetical"
    USER_SUPPLIED = "user_supplied"


class ActionType(str, Enum):
    ACTIVATE_LINK = "activate_link"
    CAPACITY_OVERRIDE = "capacity_override"


class CapacityMode(str, Enum):
    MULTIPLIER = "multiplier"
    ABSOLUTE = "absolute"


class MitigationCombineMode(str, Enum):
    ADD = "add"
    REPLACE = "replace"


@dataclass
class Node:
    id: str
    name: str
    node_type: NodeType
    criticality: Criticality = Criticality.MEDIUM
    location_text: Optional[str] = None
    region_code: Optional[str] = None
    is_active: bool = True
    source_status: SourceStatus = SourceStatus.SYNTHETIC
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None

    @property
    def is_operational(self) -> bool:
        return self.node_type != NodeType.DIGITAL_SERVICE


@dataclass
class Product:
    id: str
    sku: str
    name: str
    unit_name: str
    is_critical: bool = False
    notes: Optional[str] = None


@dataclass
class PhysicalLink:
    id: str
    origin_node_id: str
    destination_node_id: str
    product_id: str
    max_units_per_day: int
    transit_days: int = 0
    priority: int = 1
    baseline_enabled: bool = True
    is_alternate: bool = False
    cost_per_unit: Optional[float] = None
    distance_km: float = 0.0
    toll_cost: float = 0.0
    freight_rate_per_unit: float = 0.0
    notes: Optional[str] = None


@dataclass
class ServiceDependency:
    id: str
    service_node_id: str
    dependent_node_id: str
    dependency_type: str = "critical_system"
    failure_mode: str = "capacity_degradation"
    remaining_capacity_factor: float = 0.0  # Fraction [0, 1] remaining if service down
    source_status: SourceStatus = SourceStatus.SYNTHETIC
    notes: Optional[str] = None


@dataclass
class InventoryPosition:
    node_id: str
    product_id: str
    on_hand_units: int
    storage_capacity_units: Optional[int] = None
    as_of_day: int = 1


@dataclass
class SupplyProfile:
    node_id: str
    product_id: str
    units_per_day: int
    active_from_day: int = 1
    active_to_day: int = 90
    notes: Optional[str] = None


@dataclass
class DemandProfile:
    node_id: str
    product_id: str
    units_per_day: int
    active_from_day: int = 1
    active_to_day: int = 90
    notes: Optional[str] = None


@dataclass
class IncidentScenario:
    id: str
    name: str
    event_type: str
    target_node_id: str  # Can be digital_service or operational node
    status: SourceStatus = SourceStatus.HYPOTHETICAL
    start_day: int = 1
    duration_days: int = 10
    remaining_capacity_factor: float = 0.33  # Fraction remaining
    capacity_mode: CapacityMode = CapacityMode.MULTIPLIER
    absolute_capacity_value: Optional[int] = None
    source_title: Optional[str] = None
    source_url: Optional[str] = None
    source_excerpt: Optional[str] = None
    confirmed_by_user: bool = False
    assumptions_note: str = ""


@dataclass
class MitigationOption:
    id: str
    scenario_id: str
    name: str
    action_type: ActionType
    start_day: int
    end_day: Optional[int] = None
    target_link_id: Optional[str] = None
    target_node_id: Optional[str] = None
    capacity_effect: MitigationCombineMode = MitigationCombineMode.ADD  # 'add' or 'replace'
    capacity_value: int = 0  # Units added or absolute units replaced
    setup_cost: Optional[float] = None
    variable_cost_per_unit: Optional[float] = None
    assumption_note: str = ""


@dataclass
class DailyMetricRow:
    day: int
    node_id: str
    product_id: str
    opening_inventory: int
    supply_added: int
    arrivals_due: int
    arrivals_accepted: int
    demand: int
    fulfilled: int
    unmet: int
    outbound_dispatched: int
    overflow_removed: int
    ending_inventory: int
    in_transit_units: int
    effective_capacity_factor: float
    impact_reasons: List[str] = field(default_factory=list)

    def verify_invariant(self) -> bool:
        """
        SRS-SIM-010: opening + supply + accepted arrivals - fulfilled - dispatched - overflow = ending
        """
        lhs = (
            self.opening_inventory
            + self.supply_added
            + self.arrivals_accepted
            - self.fulfilled
            - self.outbound_dispatched
            - self.overflow_removed
        )
        return lhs == self.ending_inventory


@dataclass
class InTransitShipment:
    shipment_id: str
    link_id: str
    origin_node_id: str
    destination_node_id: str
    product_id: str
    quantity: int
    dispatch_day: int
    arrival_day: int


@dataclass
class OperationalEventRow:
    event_id: str
    day: int
    facility_id: str
    facility_name: str
    event_type: str  # 'inbound_consignment', 'outbound_dispatch', 'shortage', 'quiescent'
    counterpart: str  # e.g. "JNPT Gateway Terminal" or "Apex Regional Hospital"
    units_delta: int  # e.g. +300, -900, 0
    balance_after: int
    impact_level: str  # 'normal', 'mitigation', 'warning', 'critical'
    description: str


@dataclass
class SimulationRunSummary:
    run_id: str
    scenario_id: str
    horizon_days: int
    input_hash: str
    engine_version: str = "0.1.0"
    total_demand_units: int = 0
    fulfilled_units: int = 0
    unmet_units: int = 0
    fill_rate: Optional[float] = None
    first_shortage_day: Optional[int] = None  # None if no stockout
    ending_stock: int = 0
    in_transit_units: int = 0
    overflow_units: int = 0
    total_response_cost: Optional[float] = None
    cost_is_complete: bool = True
    assumptions_summary: List[str] = field(default_factory=list)
    daily_rows: List[DailyMetricRow] = field(default_factory=list)
    events: List[OperationalEventRow] = field(default_factory=list)
    impacted_nodes: List[Dict[str, Any]] = field(default_factory=list)

