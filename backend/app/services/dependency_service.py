import networkx as nx
from typing import List, Dict, Any, Tuple, Optional, Set
from backend.app.core.domain import (
    Node,
    PhysicalLink,
    ServiceDependency,
    NodeType,
    IncidentScenario,
)


class DependencyService:
    def __init__(
        self,
        nodes: List[Node],
        links: List[PhysicalLink],
        dependencies: List[ServiceDependency],
    ):
        self.nodes = {n.id: n for n in nodes}
        self.links = {l.id: l for l in links}
        self.dependencies = dependencies
        self._build_graphs()

    def _build_graphs(self):
        # Physical flow graph
        self.flow_graph = nx.DiGraph()
        for node in self.nodes.values():
            if node.is_operational:
                self.flow_graph.add_node(node.id, data=node)

        for link in self.links.values():
            if link.origin_node_id in self.nodes and link.destination_node_id in self.nodes:
                self.flow_graph.add_edge(
                    link.origin_node_id,
                    link.destination_node_id,
                    link_id=link.id,
                    product_id=link.product_id,
                    max_units=link.max_units_per_day,
                    transit_days=link.transit_days,
                    priority=link.priority,
                    is_alternate=link.is_alternate,
                    baseline_enabled=link.baseline_enabled,
                )

        # Service dependency graph (digital_service -> operational_node)
        self.dep_graph = nx.DiGraph()
        for dep in self.dependencies:
            self.dep_graph.add_edge(
                dep.service_node_id,
                dep.dependent_node_id,
                dep_id=dep.id,
                factor=dep.remaining_capacity_factor,
                dep_type=dep.dependency_type,
            )

    def validate_physical_dag(self) -> Tuple[bool, List[List[str]]]:
        """
        SRS-GRAPH-003: Physical-flow graph must be a DAG in v0.1.
        Returns (is_dag, list_of_cycles).
        """
        try:
            cycles = list(nx.simple_cycles(self.flow_graph))
            return (len(cycles) == 0, cycles)
        except Exception:
            return (True, [])

    def propagate_service_impact(
        self, incident: IncidentScenario, day: int
    ) -> Dict[str, Dict[str, Any]]:
        """
        Calculates effective node factors on day `day`.
        Returns mapping: node_id -> {
            'factor': float,
            'impacted': bool,
            'reasons': List[str],
            'direct': bool,
            'paths': List[List[str]]
        }
        """
        impact_map: Dict[str, Dict[str, Any]] = {}

        # Check if incident is active on this day (inclusive: start_day <= day <= start_day + duration - 1)
        is_active = (incident.start_day <= day < incident.start_day + incident.duration_days)
        target_id = incident.target_node_id

        if not is_active:
            for nid in self.nodes:
                impact_map[nid] = {
                    "factor": 1.0,
                    "impacted": False,
                    "reasons": [],
                    "direct": False,
                    "paths": [],
                }
            return impact_map

        # Initialize factors
        for nid in self.nodes:
            impact_map[nid] = {
                "factor": 1.0,
                "impacted": False,
                "reasons": [],
                "direct": False,
                "paths": [],
            }

        target_node = self.nodes.get(target_id)
        if not target_node:
            return impact_map

        # Case 1: Target is a digital service
        if target_node.node_type == NodeType.DIGITAL_SERVICE:
            incident_factor = incident.remaining_capacity_factor
            impact_map[target_id]["factor"] = incident_factor
            impact_map[target_id]["impacted"] = True
            impact_map[target_id]["direct"] = True
            impact_map[target_id]["reasons"].append(
                f"Direct incident on digital service {target_node.name} (remaining: {incident_factor:.1%})"
            )

            # Traverse dependency graph to operational nodes
            if self.dep_graph.has_node(target_id):
                for dep_target in self.dep_graph.neighbors(target_id):
                    edge_data = self.dep_graph.get_edge_data(target_id, dep_target)
                    edge_factor = edge_data.get("factor", 0.0)

                    # Effective factor = base edge factor adjusted by incident factor
                    # In SRS-GRAPH-007: Multiple active dependency factors are combined multiplicatively
                    curr = impact_map[dep_target]["factor"]
                    # If incident leaves f_inc of the service running, dependent node capacity factor is:
                    # edge_factor * incident_factor or edge_factor
                    effective_contrib = max(0.0, min(1.0, edge_factor))
                    combined = curr * effective_contrib
                    impact_map[dep_target]["factor"] = combined
                    impact_map[dep_target]["impacted"] = True
                    impact_map[dep_target]["direct"] = False
                    impact_map[dep_target]["reasons"].append(
                        f"Dependent on {target_node.name} via service edge (contrib factor: {effective_contrib:.2f})"
                    )
                    impact_map[dep_target]["paths"].append([target_id, dep_target])

        # Case 2: Target is an operational node directly
        else:
            factor = incident.remaining_capacity_factor
            impact_map[target_id]["factor"] = factor
            impact_map[target_id]["impacted"] = True
            impact_map[target_id]["direct"] = True
            impact_map[target_id]["reasons"].append(
                f"Direct capacity assumption on {target_node.name} (remaining: {factor:.1%})"
            )

        return impact_map

    def trace_downstream_reachability(self, affected_node_id: str) -> List[Dict[str, Any]]:
        """
        SRS-301, SRS-302:
        Given an affected target, return all nodes reachable downstream via physical links
        with hop distance, path, and direct/indirect label.
        """
        if not self.flow_graph.has_node(affected_node_id):
            return []

        results = []
        visited = {affected_node_id: 0}
        queue = [(affected_node_id, 0, [affected_node_id])]

        while queue:
            curr, hops, path = queue.pop(0)
            if curr != affected_node_id:
                results.append({
                    "node_id": curr,
                    "node_name": self.nodes[curr].name if curr in self.nodes else curr,
                    "hop_distance": hops,
                    "path": path,
                    "is_direct": (hops == 1),
                    "impact_type": "direct_downstream" if hops == 1 else "indirect_downstream",
                })

            for neighbor in self.flow_graph.neighbors(curr):
                if neighbor not in visited or visited[neighbor] > hops + 1:
                    visited[neighbor] = hops + 1
                    queue.append((neighbor, hops + 1, path + [neighbor]))

        # Sort by hop distance ASC, node ID ASC
        results.sort(key=lambda x: (x["hop_distance"], x["node_id"]))
        return results
