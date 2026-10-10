from typing import List, Dict, Any, Optional
from backend.app.core.domain import (
    IncidentScenario,
    MitigationOption,
    SimulationRunSummary,
    CapacityMode,
)
from backend.app.services.simulation_engine import SimulationEngine


class ComparisonService:
    def __init__(self, engine: SimulationEngine):
        self.engine = engine

    def compare_scenarios(
        self,
        scenario: IncidentScenario,
        mitigations: List[MitigationOption],
        horizon_days: int = 10,
    ) -> Dict[str, Any]:
        """
        Runs:
        1. 'No Incident' baseline
        2. 'Do Nothing' (incident active, 0 mitigations)
        3. Each individual mitigation option
        4. Combined mitigations (if >= 2 options)
        Returns structured comparison table and overlaid time series data.
        """
        # 1. No incident baseline
        no_incident_scen = IncidentScenario(
            id="scen-no-incident",
            name="Normal Operations (No Incident)",
            event_type="none",
            target_node_id=scenario.target_node_id,
            start_day=999,
            duration_days=1,
            remaining_capacity_factor=1.0,
            capacity_mode=CapacityMode.MULTIPLIER,
            assumptions_note="Uninterrupted baseline supply and demand flow.",
        )
        base_summary = self.engine.run(no_incident_scen, [], horizon_days, run_id="run-base")

        # 2. Do nothing (outage without recovery)
        do_nothing_summary = self.engine.run(scenario, [], horizon_days, run_id="run-do-nothing")

        # 3. Individual options
        option_summaries: List[Dict[str, Any]] = []
        for i, mit in enumerate(mitigations, 1):
            opt_summary = self.engine.run(scenario, [mit], horizon_days, run_id=f"run-opt-{i}")
            option_summaries.append({
                "mitigation_id": mit.id,
                "label": mit.name,
                "action_type": mit.action_type.value,
                "start_day": mit.start_day,
                "summary": opt_summary,
                "assumption_note": mit.assumption_note,
            })

        # 4. Combined case
        combined_summary: Optional[SimulationRunSummary] = None
        if len(mitigations) >= 2:
            combined_summary = self.engine.run(scenario, mitigations, horizon_days, run_id="run-combined")

        # Build comparison table rows
        rows = [
            {
                "run_id": "base",
                "label": "No Incident Baseline",
                "scenario_name": no_incident_scen.name,
                "mitigation_count": 0,
                "first_stockout_day": base_summary.first_shortage_day,
                "unmet_demand_units": base_summary.unmet_units,
                "ending_stock_units": base_summary.ending_stock,
                "fill_rate_pct": base_summary.fill_rate,
                "overflow_units": base_summary.overflow_units,
                "response_cost": base_summary.total_response_cost,
                "cost_is_complete": base_summary.cost_is_complete,
                "delta_unmet_vs_do_nothing": base_summary.unmet_units - do_nothing_summary.unmet_units,
                "delta_stock_vs_do_nothing": base_summary.ending_stock - do_nothing_summary.ending_stock,
                "assumptions": ["Normal operations uninterrupted"],
            },
            {
                "run_id": "do-nothing",
                "label": "Do Nothing (Unmitigated)",
                "scenario_name": scenario.name,
                "mitigation_count": 0,
                "first_stockout_day": do_nothing_summary.first_shortage_day,
                "unmet_demand_units": do_nothing_summary.unmet_units,
                "ending_stock_units": do_nothing_summary.ending_stock,
                "fill_rate_pct": do_nothing_summary.fill_rate,
                "overflow_units": do_nothing_summary.overflow_units,
                "response_cost": do_nothing_summary.total_response_cost,
                "cost_is_complete": do_nothing_summary.cost_is_complete,
                "delta_unmet_vs_do_nothing": 0,
                "delta_stock_vs_do_nothing": 0,
                "assumptions": [scenario.assumptions_note],
            },
        ]

        for opt in option_summaries:
            s: SimulationRunSummary = opt["summary"]
            rows.append({
                "run_id": f"opt-{opt['mitigation_id']}",
                "label": opt["label"],
                "scenario_name": scenario.name,
                "mitigation_count": 1,
                "first_stockout_day": s.first_shortage_day,
                "unmet_demand_units": s.unmet_units,
                "ending_stock_units": s.ending_stock,
                "fill_rate_pct": s.fill_rate,
                "overflow_units": s.overflow_units,
                "response_cost": s.total_response_cost,
                "cost_is_complete": s.cost_is_complete,
                "delta_unmet_vs_do_nothing": s.unmet_units - do_nothing_summary.unmet_units,
                "delta_stock_vs_do_nothing": s.ending_stock - do_nothing_summary.ending_stock,
                "assumptions": [opt["assumption_note"]],
            })

        if combined_summary:
            rows.append({
                "run_id": "combined",
                "label": "Combined Protocol (All Mitigations)",
                "scenario_name": scenario.name,
                "mitigation_count": len(mitigations),
                "first_stockout_day": combined_summary.first_shortage_day,
                "unmet_demand_units": combined_summary.unmet_units,
                "ending_stock_units": combined_summary.ending_stock,
                "fill_rate_pct": combined_summary.fill_rate,
                "overflow_units": combined_summary.overflow_units,
                "response_cost": combined_summary.total_response_cost,
                "cost_is_complete": combined_summary.cost_is_complete,
                "delta_unmet_vs_do_nothing": combined_summary.unmet_units - do_nothing_summary.unmet_units,
                "delta_stock_vs_do_nothing": combined_summary.ending_stock - do_nothing_summary.ending_stock,
                "assumptions": [m.assumption_note for m in mitigations],
            })

        # Daily trajectory overlay for charting
        chart_days: List[Dict[str, Any]] = []
        for day in range(1, horizon_days + 1):
            day_entry: Dict[str, Any] = {"day": f"Day {day}"}
            # Add base ending stock
            base_rows = [r for r in base_summary.daily_rows if r.day == day]
            day_entry["Base"] = sum(r.ending_inventory for r in base_rows)

            dn_rows = [r for r in do_nothing_summary.daily_rows if r.day == day]
            day_entry["Do Nothing"] = sum(r.ending_inventory for r in dn_rows)

            for opt in option_summaries:
                opt_rows = [r for r in opt["summary"].daily_rows if r.day == day]
                day_entry[opt["label"]] = sum(r.ending_inventory for r in opt_rows)

            if combined_summary:
                cb_rows = [r for r in combined_summary.daily_rows if r.day == day]
                day_entry["Combined"] = sum(r.ending_inventory for r in cb_rows)

            chart_days.append(day_entry)

        return {
            "horizon_days": horizon_days,
            "scenario": {
                "id": scenario.id,
                "name": scenario.name,
                "status": scenario.status.value,
                "target_node_id": scenario.target_node_id,
                "duration_days": scenario.duration_days,
                "source_title": scenario.source_title,
                "source_url": scenario.source_url,
            },
            "rows": rows,
            "chart_trajectories": chart_days,
            "summaries": {
                "base": base_summary,
                "do_nothing": do_nothing_summary,
                "options": option_summaries,
                "combined": combined_summary,
            },
        }
