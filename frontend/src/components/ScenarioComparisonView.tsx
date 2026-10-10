import React from 'react';
import type { ComparisonResult } from '../types';
import { GitCompare, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  comparison: ComparisonResult;
  onOpenInspector: (metricName: string, value: any) => void;
}

export const ScenarioComparisonView: React.FC<Props> = ({ comparison, onOpenInspector }) => {
  const { rows, chart_trajectories, horizon_days } = comparison;

  const chartColors: Record<string, string> = {
    'Base': '#94a3b8',
    'Do Nothing': '#ef4444',
    'Alternate Port Reroute (+400/day from Day 3)': '#06b6d4',
    'Manual Fallback (raises throughput to 450/day from Day 4)': '#f59e0b',
    'Combined': '#10b981',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Notice Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '10px' }}>
        <AlertCircle size={20} color="#60a5fa" />
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
          <strong>Heuristic Trade-off Comparison:</strong> All runs evaluated against the identical {horizon_days}-day horizon and demand profile. Results reflect user-confirmed capacity assumptions, not guaranteed forecasts.
        </div>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitCompare size={20} color="#3b82f6" />
              Side-by-Side Mitigation Comparison Matrix
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Evaluating operational continuity metrics across baseline and recovery strategies.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Strategy / Scenario</th>
                <th>First Shortage</th>
                <th>Total Unmet</th>
                <th>Ending Stock</th>
                <th>Fill Rate</th>
                <th>Response Cost</th>
                <th>Unmet Demand Delta (vs Do Nothing)</th>
                <th>Stock Delta (vs Do Nothing)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isDoNothing = row.run_id === 'do-nothing';
                const isBase = row.run_id === 'base';
                const isCombined = row.run_id === 'combined';

                return (
                  <tr
                    key={row.run_id}
                    style={{
                      background: isCombined ? 'rgba(16, 185, 129, 0.08)' : isDoNothing ? 'rgba(239, 68, 68, 0.06)' : undefined,
                      fontWeight: isCombined ? 600 : 'normal',
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{row.label}</span>
                        {isCombined && <span className="badge badge-mitigation">Combined</span>}
                        {isDoNothing && <span className="badge badge-critical">Unmitigated</span>}
                        {isBase && <span className="badge badge-synthetic">Baseline</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {row.assumptions[0] || ''}
                      </div>
                    </td>

                    <td>
                      {row.first_stockout_day ? (
                        <span className="badge badge-critical" style={{ cursor: 'pointer' }} onClick={() => onOpenInspector('First Shortage Day', row.first_stockout_day)}>
                          Day {row.first_stockout_day}
                        </span>
                      ) : (
                        <span className="badge badge-confirmed">No Stockout</span>
                      )}
                    </td>

                    <td className="font-mono" style={{ color: row.unmet_demand_units > 0 ? '#f87171' : '#34d399' }}>
                      {row.unmet_demand_units.toLocaleString()} units
                    </td>

                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      {row.ending_stock_units.toLocaleString()} units
                    </td>

                    <td className="font-mono">
                      {row.fill_rate_pct !== null ? `${row.fill_rate_pct}%` : 'N/A'}
                    </td>

                    <td className="font-mono">
                      {row.response_cost !== null ? (
                        <span>${row.response_cost.toLocaleString()}</span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>Unknown (N/A)</span>
                      )}
                    </td>

                    <td>
                      {row.delta_unmet_vs_do_nothing < 0 ? (
                        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                          <ArrowDownRight size={16} /> {Math.abs(row.delta_unmet_vs_do_nothing).toLocaleString()} saved
                        </span>
                      ) : row.delta_unmet_vs_do_nothing === 0 ? (
                        <span style={{ color: 'var(--text-dim)' }}>0 (baseline)</span>
                      ) : (
                        <span style={{ color: '#f87171' }}>+{row.delta_unmet_vs_do_nothing}</span>
                      )}
                    </td>

                    <td>
                      {row.delta_stock_vs_do_nothing > 0 ? (
                        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                          <ArrowUpRight size={16} /> +{row.delta_stock_vs_do_nothing.toLocaleString()} units
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overlaid Trajectory Chart (Pure SVG) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} color="#06b6d4" />
              Daily Inventory Trajectory Overlay
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Simulated inventory on hand at Central Distribution Hub across all evaluated options.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
            {Object.entries(chartColors).map(([name, col]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', background: col, borderRadius: '2px', display: 'inline-block' }}></span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Line Chart */}
        <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(10, 14, 24, 0.7)', borderRadius: '10px', padding: '16px 12px' }}>
          <svg viewBox="0 0 880 320" style={{ width: '100%', minWidth: '750px', height: 'auto', display: 'block' }}>
            {/* Grid lines */}
            {[0, 1000, 2000, 3000, 4000, 5000].map((val) => {
              const y = 280 - (val / 5500) * 240;
              return (
                <g key={val}>
                  <line x1="60" y1={y} x2="840" y2={y} stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="4,4" />
                  <text x="50" y={y + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="var(--font-mono)">
                    {val}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {chart_trajectories.map((pt, idx) => {
              const x = 70 + (idx / (chart_trajectories.length - 1 || 1)) * 740;
              return (
                <text key={idx} x={x} y="305" fill="#94a3b8" fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)">
                  {pt.day}
                </text>
              );
            })}

            {/* Render Lines for each scenario */}
            {Object.entries(chartColors).map(([curveName, color]) => {
              const points = chart_trajectories
                .map((pt, idx) => {
                  const x = 70 + (idx / (chart_trajectories.length - 1 || 1)) * 740;
                  const val = pt[curveName] ?? pt[curveName === 'Base' ? 'Base' : curveName] ?? 0;
                  const y = 280 - (val / 5500) * 240;
                  return `${x},${y}`;
                })
                .join(' ');

              return (
                <g key={curveName}>
                  <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth={curveName === 'Combined' || curveName === 'Do Nothing' ? '3' : '2'}
                    strokeDasharray={curveName === 'Base' ? '4,4' : undefined}
                    points={points}
                    opacity="0.9"
                  />
                  {chart_trajectories.map((pt, idx) => {
                    const x = 70 + (idx / (chart_trajectories.length - 1 || 1)) * 740;
                    const val = pt[curveName] ?? 0;
                    const y = 280 - (val / 5500) * 240;
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r="3.5"
                        fill={color}
                        stroke="#0a0d14"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
