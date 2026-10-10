import React from 'react';
import type { Node, PhysicalLink, ServiceDependency, IncidentScenario } from '../types';
import { Server, Anchor, Warehouse, Building2, Truck } from 'lucide-react';

interface Props {
  nodes: Node[];
  links: PhysicalLink[];
  dependencies: ServiceDependency[];
  scenario: IncidentScenario;
  onSelectNode: (node: Node) => void;
  selectedNode: Node | null;
}

export const NetworkGraph: React.FC<Props> = ({
  nodes,
  links,
  dependencies,
  scenario,
  onSelectNode,
  selectedNode,
}) => {
  // Coordinates mapping for clear layout
  const nodePositions: Record<string, { x: number; y: number }> = {
    'digital-tos-booking': { x: 300, y: 70 },
    'supp-pharma-europe': { x: 100, y: 220 },
    'port-jnpt-terminal': { x: 300, y: 220 },
    'port-hazira-alt': { x: 300, y: 370 },
    'wh-mumbai-central': { x: 580, y: 260 },
    'hosp-apex-demand': { x: 840, y: 260 },
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'digital_service':
        return <Server size={18} color="#06b6d4" />;
      case 'terminal':
      case 'port':
        return <Anchor size={18} color="#3b82f6" />;
      case 'warehouse':
        return <Warehouse size={18} color="#f59e0b" />;
      case 'hospital':
        return <Building2 size={18} color="#ef4444" />;
      default:
        return <Truck size={18} color="#a855f7" />;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Operational &amp; Cyber Dependency Network
            <span className="badge badge-synthetic">DAG Validated</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Interactive model connecting IT services to physical supply routes. Click any node to inspect.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '2px', background: '#3b82f6', display: 'inline-block' }}></span>
            <span>Physical Flow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '2px', borderTop: '2px dashed #06b6d4', display: 'inline-block' }}></span>
            <span>IT Dependency</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '2px', borderTop: '2px dashed #10b981', display: 'inline-block' }}></span>
            <span>Alternate Bypass</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(10, 14, 24, 0.7)', borderRadius: '10px', padding: '10px 0' }}>
        <svg viewBox="0 0 980 470" style={{ width: '100%', minWidth: '850px', height: 'auto', display: 'block' }}>
          <defs>
            <marker id="arrow-blue" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
            </marker>
            <marker id="arrow-cyan" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
            </marker>
            <marker id="arrow-green" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>
          </defs>

          {/* Render Service Dependencies (Dashed Cyan Lines) */}
          {dependencies.map((dep) => {
            const fromPos = nodePositions[dep.service_node_id] || { x: 150, y: 150 };
            const toPos = nodePositions[dep.dependent_node_id] || { x: 300, y: 220 };
            return (
              <g key={dep.id}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  strokeDasharray="5,5"
                  markerEnd="url(#arrow-cyan)"
                  opacity="0.85"
                />
                <text
                  x={(fromPos.x + toPos.x) / 2 + 10}
                  y={(fromPos.y + toPos.y) / 2}
                  fill="#06b6d4"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                >
                  dep: {(dep.remaining_capacity_factor * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Render Physical Links */}
          {links.map((link) => {
            const fromPos = nodePositions[link.origin_node_id] || { x: 100, y: 100 };
            const toPos = nodePositions[link.destination_node_id] || { x: 500, y: 250 };
            const isAlt = link.is_alternate;
            const strokeColor = isAlt ? '#10b981' : '#3b82f6';

            return (
              <g key={link.id}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  strokeDasharray={isAlt ? '4,4' : undefined}
                  markerEnd={isAlt ? 'url(#arrow-green)' : 'url(#arrow-blue)'}
                  opacity="0.8"
                />
                <text
                  x={(fromPos.x + toPos.x) / 2}
                  y={(fromPos.y + toPos.y) / 2 - 8}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {link.max_units_per_day} u/d {link.transit_days > 0 ? `(${link.transit_days}d)` : ''}
                </text>
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node) => {
            const pos = nodePositions[node.id] || { x: 450, y: 200 };
            const isTarget = scenario.target_node_id === node.id;
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                onClick={() => onSelectNode(node)}
                style={{ cursor: 'pointer' }}
                className={isTarget ? 'pulse-node' : ''}
              >
                {/* Node Box */}
                <rect
                  x={pos.x - 90}
                  y={pos.y - 30}
                  width="180"
                  height="60"
                  rx="10"
                  fill={isTarget ? 'rgba(239, 68, 68, 0.22)' : isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(18, 24, 38, 0.95)'}
                  stroke={isTarget ? '#ef4444' : isSelected ? '#3b82f6' : 'rgba(80, 110, 160, 0.35)'}
                  strokeWidth={isTarget || isSelected ? '2' : '1'}
                />

                {/* Node Icon Circle */}
                <circle
                  cx={pos.x - 65}
                  cy={pos.y}
                  r="16"
                  fill="rgba(255, 255, 255, 0.06)"
                  stroke="rgba(255, 255, 255, 0.1)"
                />
                <foreignObject x={pos.x - 74} y={pos.y - 9} width="18" height="18">
                  {getNodeIcon(node.node_type)}
                </foreignObject>

                {/* Node Text */}
                <text
                  x={pos.x - 42}
                  y={pos.y - 8}
                  fill="#f1f5f9"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="var(--font-sans)"
                >
                  {node.name.length > 17 ? node.name.slice(0, 16) + '…' : node.name}
                </text>

                <text
                  x={pos.x - 42}
                  y={pos.y + 12}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {node.node_type.toUpperCase()}
                </text>

                {/* Incident Flag if Targeted */}
                {isTarget && (
                  <g transform={`translate(${pos.x + 65}, ${pos.y - 25})`}>
                    <circle cx="0" cy="0" r="10" fill="#ef4444" />
                    <text x="0" y="3" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">!</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Node Inspector Drawer */}
      {selectedNode && (
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{selectedNode.name}</span>
                <span className="badge badge-synthetic font-mono">{selectedNode.id}</span>
                <span className={`badge ${selectedNode.criticality === 'critical' ? 'badge-critical' : 'badge-hypothetical'}`}>
                  {selectedNode.criticality}
                </span>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {selectedNode.notes || 'No notes registered for this entity.'}
              </p>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span>Type: <strong style={{ color: '#fff' }}>{selectedNode.node_type}</strong></span>
                <span>Region: <strong style={{ color: '#fff' }}>{selectedNode.region_code || 'N/A'}</strong></span>
                <span>Status: <strong style={{ color: '#fff' }}>{selectedNode.source_status}</strong></span>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => onSelectNode(null as any)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
