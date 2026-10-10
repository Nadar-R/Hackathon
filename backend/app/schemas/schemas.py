from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from backend.app.core.domain import (
    NodeType,
    Criticality,
    SourceStatus,
    ActionType,
    CapacityMode,
    MitigationCombineMode,
)


class NodeSchema(BaseModel):
    id: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=120)
    node_type: NodeType
    criticality: Criticality = Criticality.MEDIUM
    location_text: Optional[str] = None
    region_code: Optional[str] = None
    is_active: bool = True
    source_status: SourceStatus = SourceStatus.SYNTHETIC
    notes: Optional[str] = None


class ProductSchema(BaseModel):
    id: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    unit_name: str = Field(..., min_length=1)
    is_critical: bool = False
    notes: Optional[str] = None


class PhysicalLinkSchema(BaseModel):
    id: str = Field(..., min_length=1)
    origin_node_id: str
    destination_node_id: str
    product_id: str
    max_units_per_day: int = Field(..., ge=0)
    transit_days: int = Field(0, ge=0)
    priority: int = Field(1, ge=1)
    baseline_enabled: bool = True
    is_alternate: bool = False
    cost_per_unit: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None

    @field_validator("destination_node_id")
    @classmethod
    def prevent_self_loops(cls, v, info):
        if "origin_node_id" in info.data and v == info.data["origin_node_id"]:
            raise ValueError("origin_node_id and destination_node_id must differ (no self-loops).")
        return v


class ServiceDependencySchema(BaseModel):
    id: str = Field(..., min_length=1)
    service_node_id: str
    dependent_node_id: str
    dependency_type: str = "critical_system"
    failure_mode: str = "capacity_degradation"
    remaining_capacity_factor: float = Field(..., ge=0.0, le=1.0)
    source_status: SourceStatus = SourceStatus.SYNTHETIC
    notes: Optional[str] = None


class InventoryPositionSchema(BaseModel):
    node_id: str
    product_id: str
    on_hand_units: int = Field(..., ge=0)
    storage_capacity_units: Optional[int] = Field(None, ge=0)
    as_of_day: int = Field(1, ge=1)


class SupplyProfileSchema(BaseModel):
    node_id: str
    product_id: str
    units_per_day: int = Field(..., ge=0)
    active_from_day: int = Field(1, ge=1)
    active_to_day: int = Field(90, ge=1)
    notes: Optional[str] = None


class DemandProfileSchema(BaseModel):
    node_id: str
    product_id: str
    units_per_day: int = Field(..., ge=0)
    active_from_day: int = Field(1, ge=1)
    active_to_day: int = Field(90, ge=1)
    notes: Optional[str] = None


class IncidentScenarioSchema(BaseModel):
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    event_type: str
    target_node_id: str
    status: SourceStatus = SourceStatus.HYPOTHETICAL
    start_day: int = Field(1, ge=1)
    duration_days: int = Field(1, ge=1, le=90)
    remaining_capacity_factor: float = Field(1.0, ge=0.0, le=1.0)
    capacity_mode: CapacityMode = CapacityMode.MULTIPLIER
    absolute_capacity_value: Optional[int] = Field(None, ge=0)
    source_title: Optional[str] = None
    source_url: Optional[str] = None
    source_excerpt: Optional[str] = None
    confirmed_by_user: bool = False
    assumptions_note: str = ""


class MitigationOptionSchema(BaseModel):
    id: str = Field(..., min_length=1)
    scenario_id: str
    name: str = Field(..., min_length=1)
    action_type: ActionType
    start_day: int = Field(1, ge=1)
    end_day: Optional[int] = Field(None, ge=1)
    target_link_id: Optional[str] = None
    target_node_id: Optional[str] = None
    capacity_effect: MitigationCombineMode = MitigationCombineMode.ADD
    capacity_value: int = Field(0, ge=0)
    setup_cost: Optional[float] = Field(None, ge=0)
    variable_cost_per_unit: Optional[float] = Field(None, ge=0)
    assumption_note: str = Field(..., min_length=1)


class DatasetSchema(BaseModel):
    nodes: List[NodeSchema]
    products: List[ProductSchema]
    links: List[PhysicalLinkSchema]
    dependencies: List[ServiceDependencySchema]
    inventory: List[InventoryPositionSchema]
    supply_profiles: List[SupplyProfileSchema]
    demand_profiles: List[DemandProfileSchema]


class SimulateRequest(BaseModel):
    dataset: DatasetSchema
    scenario: IncidentScenarioSchema
    mitigations: List[MitigationOptionSchema] = Field(default_factory=list)
    horizon_days: int = Field(10, ge=1, le=90)


class CompareRequest(BaseModel):
    dataset: DatasetSchema
    scenario: IncidentScenarioSchema
    mitigations: List[MitigationOptionSchema] = Field(default_factory=list)
    horizon_days: int = Field(10, ge=1, le=90)
