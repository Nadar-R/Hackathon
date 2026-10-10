export type NodeType =
  | 'supplier'
  | 'port'
  | 'terminal'
  | 'carrier'
  | 'warehouse'
  | 'manufacturer'
  | 'retailer'
  | 'hospital'
  | 'customer'
  | 'digital_service'
  | 'other';

export type Criticality = 'low' | 'medium' | 'high' | 'critical';

export type SourceStatus =
  | 'synthetic'
  | 'confirmed_public'
  | 'reported_unconfirmed'
  | 'known_vulnerability'
  | 'hypothetical'
  | 'user_supplied';

export type ActionType = 'activate_link' | 'capacity_override';
export type MitigationCombineMode = 'add' | 'replace';
export type CapacityMode = 'multiplier' | 'absolute';

export interface Node {
  id: string;
  name: string;
  node_type: NodeType;
  criticality: Criticality;
  location_text?: string;
  region_code?: string;
  is_active: boolean;
  source_status: SourceStatus;
  notes?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit_name: string;
  is_critical: boolean;
  notes?: string;
}

export interface PhysicalLink {
  id: string;
  origin_node_id: string;
  destination_node_id: string;
  product_id: string;
  max_units_per_day: number;
  transit_days: number;
  priority: number;
  baseline_enabled: boolean;
  is_alternate: boolean;
  cost_per_unit?: number | null;
  notes?: string;
}

export interface ServiceDependency {
  id: string;
  service_node_id: string;
  dependent_node_id: string;
  dependency_type: string;
  failure_mode: string;
  remaining_capacity_factor: number;
  source_status: SourceStatus;
  notes?: string;
}

export interface InventoryPosition {
  node_id: string;
  product_id: string;
  on_hand_units: number;
  storage_capacity_units?: number | null;
  as_of_day: number;
}

export interface SupplyProfile {
  node_id: string;
  product_id: string;
  units_per_day: number;
  active_from_day: number;
  active_to_day: number;
  notes?: string;
}

export interface DemandProfile {
  node_id: string;
  product_id: string;
  units_per_day: number;
  active_from_day: number;
  active_to_day: number;
  notes?: string;
}

export interface IncidentScenario {
  id: string;
  name: string;
  event_type: string;
  target_node_id: string;
  status: SourceStatus;
  start_day: number;
  duration_days: number;
  remaining_capacity_factor: number;
  capacity_mode: CapacityMode;
  absolute_capacity_value?: number | null;
  source_title?: string | null;
  source_url?: string | null;
  source_excerpt?: string | null;
  confirmed_by_user: boolean;
  assumptions_note: string;
}

export interface MitigationOption {
  id: string;
  scenario_id: string;
  name: string;
  action_type: ActionType;
  start_day: number;
  end_day?: number | null;
  target_link_id?: string | null;
  target_node_id?: string | null;
  capacity_effect: MitigationCombineMode;
  capacity_value: number;
  setup_cost?: number | null;
  variable_cost_per_unit?: number | null;
  assumption_note: string;
}

export interface Dataset {
  nodes: Node[];
  products: Product[];
  links: PhysicalLink[];
  dependencies: ServiceDependency[];
  inventory: InventoryPosition[];
  supply_profiles: SupplyProfile[];
  demand_profiles: DemandProfile[];
}

export interface DailyMetricRow {
  day: number;
  node_id: string;
  product_id: string;
  opening_inventory: number;
  supply_added: number;
  arrivals_due: number;
  arrivals_accepted: number;
  demand: number;
  fulfilled: number;
  unmet: number;
  outbound_dispatched: number;
  overflow_removed: number;
  ending_inventory: number;
  in_transit_units: number;
  effective_capacity_factor: number;
  impact_reasons: string[];
}

export interface SimulationKPIs {
  total_demand_units: number;
  fulfilled_units: number;
  unmet_units: number;
  fill_rate: number | null;
  first_shortage_day: number | null;
  ending_stock: number;
  in_transit_units: number;
  overflow_units: number;
  total_response_cost: number | null;
  cost_is_complete: boolean;
}

export interface OperationalEvent {
  event_id: string;
  day: number;
  facility_id: string;
  facility_name: string;
  event_type: 'inbound_consignment' | 'outbound_dispatch' | 'shortage' | 'quiescent';
  counterpart: string;
  units_delta: number;
  balance_after: number;
  impact_level: 'normal' | 'mitigation' | 'warning' | 'critical';
  description: string;
}

export interface SimulationResult {
  run_id: string;
  input_hash: string;
  engine_version: string;
  horizon_days: number;
  kpis: SimulationKPIs;
  assumptions: string[];
  impacted_nodes: Array<{
    node_id: string;
    node_name: string;
    hop_distance: number;
    path: string[];
    is_direct: boolean;
    impact_type: string;
  }>;
  daily_rows: DailyMetricRow[];
  events: OperationalEvent[];
}

export interface ComparisonRow {
  run_id: string;
  label: string;
  scenario_name: string;
  mitigation_count: number;
  first_stockout_day: number | null;
  unmet_demand_units: number;
  ending_stock_units: number;
  fill_rate_pct: number | null;
  overflow_units: number;
  response_cost: number | null;
  cost_is_complete: boolean;
  delta_unmet_vs_do_nothing: number;
  delta_stock_vs_do_nothing: number;
  assumptions: string[];
}

export interface ComparisonResult {
  horizon_days: number;
  scenario: any;
  rows: ComparisonRow[];
  chart_trajectories: Array<{
    day: string;
    Base?: number;
    'Do Nothing'?: number;
    Combined?: number;
    [key: string]: any;
  }>;
}
