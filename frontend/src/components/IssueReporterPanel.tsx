import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  X,
  Plus,
  Navigation,
  Clock,
  DollarSign,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export interface ReportedIssue {
  id: string;
  type: 'Node' | 'Route';
  targetId: string;
  targetName: string;
  daysClosed: number;
  reason: string;
}

interface MapNodeItem {
  id: string;
  name: string;
  type?: string;
  city?: string;
  status?: string;
}

interface MapLinkItem {
  id: string;
  origin_id: string;
  destination_id: string;
  origin_name: string;
  destination_name: string;
  distance_km?: number;
  toll_cost?: number;
  status?: string;
}

interface AlternateRouteInfo {
  status: string;
  lead_time_days: number;
  toll_cost: number;
  distance_km?: number;
  is_available?: boolean;
  path_nodes?: string[];
}

interface PrimaryRouteInfo {
  status: string;
  lead_time_days?: number;
  toll_cost?: number;
  distance_km?: number;
  is_available?: boolean;
}

interface IssueReporterPanelProps {
  nodes?: MapNodeItem[];
  links?: MapLinkItem[];
  portAActive?: boolean;
  portBActive?: boolean;
  onRouteEvaluated?: (evaluationData: any) => void;
  initialAlternateRoute?: AlternateRouteInfo | null;
  initialPrimaryRoute?: PrimaryRouteInfo | null;
  /** Controlled issues state from App.tsx (for SIEM integration) */
  issues?: ReportedIssue[];
  onIssuesChange?: (issues: ReportedIssue[]) => void;
}

const DEFAULT_FALLBACK_NODES: MapNodeItem[] = [
  { id: 'node-port-a', name: 'Nhava Sheva Gateway (Port A)', type: 'port', city: 'Mumbai' },
  { id: 'node-port-b', name: 'Hazira Container Terminal (Port B)', type: 'port', city: 'Surat' },
  { id: 'node-warehouse-x', name: 'Bhiwandi Central Pharma Hub (Warehouse X)', type: 'warehouse', city: 'Bhiwandi' },
  { id: 'node-hospital-m', name: 'Apex Memorial Super-Speciality (Hospital M)', type: 'hospital', city: 'Mumbai' },
  { id: 'node-hospital-n', name: 'Ruby Regional Trauma Center (Hospital N)', type: 'hospital', city: 'Pune' },
  { id: 'node-datacenter-tos', name: 'Central Cloud & TOS Data Center', type: 'digital_service', city: 'Mumbai' },
];

const DEFAULT_FALLBACK_LINKS: MapLinkItem[] = [
  {
    id: 'link-porta-warehouse',
    origin_id: 'node-port-a',
    destination_id: 'node-warehouse-x',
    origin_name: 'Nhava Sheva Gateway (Port A)',
    destination_name: 'Bhiwandi Central Pharma Hub (Warehouse X)',
    distance_km: 48,
    toll_cost: 25,
  },
  {
    id: 'link-portb-warehouse',
    origin_id: 'node-port-b',
    destination_id: 'node-warehouse-x',
    origin_name: 'Hazira Container Terminal (Port B)',
    destination_name: 'Bhiwandi Central Pharma Hub (Warehouse X)',
    distance_km: 285,
    toll_cost: 140,
  },
  {
    id: 'link-warehouse-hospm',
    origin_id: 'node-warehouse-x',
    destination_id: 'node-hospital-m',
    origin_name: 'Bhiwandi Central Pharma Hub (Warehouse X)',
    destination_name: 'Apex Memorial Super-Speciality (Hospital M)',
    distance_km: 42,
    toll_cost: 15,
  },
  {
    id: 'link-warehouse-hospn',
    origin_id: 'node-warehouse-x',
    destination_id: 'node-hospital-n',
    origin_name: 'Bhiwandi Central Pharma Hub (Warehouse X)',
    destination_name: 'Ruby Regional Trauma Center (Hospital N)',
    distance_km: 158,
    toll_cost: 35,
  },
];

/**
 * Returns a concise, natural label for chips matching the user prompt's format:
 * e.g., "Port A", "Port B", "Warehouse X", "Hospital M", "Hospital N"
 */
function getShortTargetName(id: string, name: string): string {
  if (name.includes('Port A') || id === 'node-port-a') return 'Port A';
  if (name.includes('Port B') || id === 'node-port-b') return 'Port B';
  if (name.includes('Warehouse X') || id === 'node-warehouse-x') return 'Warehouse X';
  if (name.includes('Hospital M') || id === 'node-hospital-m') return 'Hospital M';
  if (name.includes('Hospital N') || id === 'node-hospital-n') return 'Hospital N';
  if (name.includes('Data Center') || id === 'node-datacenter-tos') return 'Data Center';

  if (id === 'link-porta-warehouse' || (name.includes('Port A') && name.includes('Warehouse'))) {
    return 'Port A → Warehouse X';
  }
  if (id === 'link-portb-warehouse' || (name.includes('Port B') && name.includes('Warehouse'))) {
    return 'Port B → Warehouse X';
  }
  if (id === 'link-warehouse-hospm' || (name.includes('Warehouse') && name.includes('Hospital M'))) {
    return 'Warehouse X → Hospital M';
  }
  if (id === 'link-warehouse-hospn' || (name.includes('Warehouse') && name.includes('Hospital N'))) {
    return 'Warehouse X → Hospital N';
  }

  const match = name.match(/\((.*?)\)/);
  if (match) return match[1];

  return name;
}

export const IssueReporterPanel: React.FC<IssueReporterPanelProps> = ({
  nodes = [],
  links = [],
  portAActive = true,
  portBActive: _portBActive = false,
  onRouteEvaluated,
  initialAlternateRoute: _initialAlternateRoute,
  initialPrimaryRoute,
  issues: controlledIssues,
  onIssuesChange,
}) => {
  // Effective list of nodes and links
  const effectiveNodes = useMemo(() => {
    return nodes && nodes.length > 0 ? nodes : DEFAULT_FALLBACK_NODES;
  }, [nodes]);

  const effectiveLinks = useMemo(() => {
    return links && links.length > 0 ? links : DEFAULT_FALLBACK_LINKS;
  }, [links]);

  // Form State
  const [targetType, setTargetType] = useState<'Node' | 'Route'>('Node');
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    effectiveNodes[0]?.id || 'node-port-a'
  );
  const [daysClosed, setDaysClosed] = useState<number>(5);
  const [reason, setReason] = useState<string>('under construction');

  // Active Issues State — controlled by parent if `issues` prop is provided
  const [internalIssues, setInternalIssues] = useState<ReportedIssue[]>([]);
  const activeIssues = controlledIssues !== undefined ? controlledIssues : internalIssues;
  const setActiveIssues = (updated: ReportedIssue[]) => {
    if (onIssuesChange) onIssuesChange(updated);
    else setInternalIssues(updated);
  };
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Latest evaluation state from API responses
  const [evalAlternateRoute, setEvalAlternateRoute] = useState<AlternateRouteInfo | null>(null);
  const [evalPrimaryRoute, setEvalPrimaryRoute] = useState<PrimaryRouteInfo | null>(null);

  // Derive target ID safely
  const isTargetValid =
    targetType === 'Node'
      ? effectiveNodes.some((n) => n.id === selectedTargetId)
      : effectiveLinks.some((l) => l.id === selectedTargetId);

  const effectiveTargetId = isTargetValid
    ? selectedTargetId
    : targetType === 'Node'
    ? effectiveNodes[0]?.id || ''
    : effectiveLinks[0]?.id || '';

  // Resolve target name for creation
  const getSelectedTargetName = (type: 'Node' | 'Route', id: string): string => {
    if (type === 'Node') {
      const found = effectiveNodes.find((n) => n.id === id);
      return found ? found.name : id;
    } else {
      const found = effectiveLinks.find((l) => l.id === id);
      return found ? `${found.origin_name} → ${found.destination_name}` : id;
    }
  };

  // POST to evaluate-with-disruptions endpoint
  const evaluateWithDisruptions = async (issuesList: ReportedIssue[]) => {
    setIsEvaluating(true);
    setError(null);

    const disabledNodeIds = issuesList
      .filter((i) => i.type === 'Node')
      .map((i) => i.targetId);
    const disabledLinkIds = issuesList
      .filter((i) => i.type === 'Route')
      .map((i) => i.targetId);

    const isPortADisabled = disabledNodeIds.includes('node-port-a');
    const isPortBDisabled = disabledNodeIds.includes('node-port-b');

    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/routing/evaluate-with-disruptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disabled_node_ids: disabledNodeIds,
          disabled_link_ids: disabledLinkIds,
          port_a_active: !isPortADisabled && portAActive,
          port_b_active: !isPortBDisabled,
        }),
      });

      if (!res.ok) {
        throw new Error(`Routing engine HTTP ${res.status}`);
      }

      const json = await res.json();

      if (json.alternate_route) {
        setEvalAlternateRoute(json.alternate_route);
      }
      if (json.primary_route) {
        setEvalPrimaryRoute(json.primary_route);
      }

      // Propagate map_nodes & map_links up to App.tsx to update GeoRouteMap
      if (onRouteEvaluated) {
        onRouteEvaluated(json);
      }
    } catch (err: any) {
      console.error('Failed to evaluate disruptions:', err);
      setError(err.message || 'Error communicating with routing engine');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle Form Submission
  const handleReportIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = effectiveTargetId;
    if (!targetId) return;

    // Check if target is already reported
    const alreadyExists = activeIssues.some((i) => i.targetId === targetId);
    if (alreadyExists) {
      alert(`An active issue is already reported for this target. Remove the existing issue first to change it.`);
      return;
    }

    const targetFullName = getSelectedTargetName(targetType, targetId);
    const newIssue: ReportedIssue = {
      id: `issue-${targetType.toLowerCase()}-${targetId}-${Date.now()}`,
      type: targetType,
      targetId: targetId,
      targetName: targetFullName,
      daysClosed: Math.max(1, Number(daysClosed) || 1),
      reason: reason.trim() || 'under construction',
    };

    const updated = [...activeIssues, newIssue];
    setActiveIssues(updated);
    evaluateWithDisruptions(updated);
  };

  // Handle Removing an Active Issue
  const handleRemoveIssue = (id: string) => {
    const updated = activeIssues.filter((i) => i.id !== id);
    setActiveIssues(updated);
    evaluateWithDisruptions(updated);
  };

  // Handle Clear All
  const handleClearAll = () => {
    setActiveIssues([]);
    evaluateWithDisruptions([]);
  };

  // Evaluate on mount so initial values reflect routing engine
  useEffect(() => {
    evaluateWithDisruptions(activeIssues);
  }, []);

  // Re-evaluate whenever the parent injects/removes issues externally (e.g., SIEM trigger)
  useEffect(() => {
    if (controlledIssues !== undefined) {
      evaluateWithDisruptions(controlledIssues);
    }
  }, [controlledIssues]);

  // Current Alternate Route values read strictly from the latest evaluate-with-disruptions response
  const currentAltStatus = evalAlternateRoute?.status ?? 'STANDBY_RESERVE';
  const currentLeadTime = evalAlternateRoute?.lead_time_days ?? 0;
  const currentTollCost = evalAlternateRoute?.toll_cost ?? 0;
  const currentDistanceKm = evalAlternateRoute?.distance_km ?? 0;
  const currentPrimRoute = evalPrimaryRoute ?? initialPrimaryRoute;

  return (
    <div
      style={{
        background: 'rgba(13, 19, 32, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: '14px',
        padding: '20px 22px',
        marginTop: '16px',
        marginBottom: '4px',
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.55)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)',
            }}
          >
            <AlertTriangle size={18} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Report Issue &amp; Infrastructure Outages
            </h3>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Report physical closures or route interruptions to trigger dynamic Dijkstra alternate path evaluation.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isEvaluating && (
            <span
              style={{
                fontSize: '11px',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 600,
              }}
            >
              <RotateCcw size={12} className="pulse-node" /> Recomputing Dijkstra paths...
            </span>
          )}

          {activeIssues.length > 0 ? (
            <span
              className="badge"
              style={{
                background: 'rgba(244, 63, 94, 0.18)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                fontSize: '11px',
                padding: '4px 10px',
              }}
            >
              <AlertOctagon size={12} /> {activeIssues.length} Active Disruption{activeIssues.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span
              className="badge"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontSize: '11px',
                padding: '4px 10px',
              }}
            >
              <CheckCircle2 size={12} /> Corridors Normal
            </span>
          )}
        </div>
      </div>

      {/* Form Controls */}
      <form onSubmit={handleReportIssue}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 1fr) minmax(240px, 2fr) minmax(110px, 1fr) minmax(180px, 2fr) auto',
            gap: '12px',
            alignItems: 'flex-end',
          }}
        >
          {/* 1. Target Type Dropdown (Node or Route) */}
          <div>
            <label
              htmlFor="issue-target-type"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Target Type
            </label>
            <select
              id="issue-target-type"
              value={targetType}
              onChange={(e) => {
                const nextType = e.target.value as 'Node' | 'Route';
                setTargetType(nextType);
                if (nextType === 'Node') {
                  setSelectedTargetId(effectiveNodes[0]?.id || 'node-port-a');
                } else {
                  setSelectedTargetId(effectiveLinks[0]?.id || 'link-porta-warehouse');
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#111a2c',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="Node">Node (Facility / Port)</option>
              <option value="Route">Route (Highway Link)</option>
            </select>
          </div>

          {/* 2. Target Selector Dropdown (Which one) */}
          <div>
            <label
              htmlFor="issue-target-item"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Which {targetType}
            </label>
            <select
              id="issue-target-item"
              value={effectiveTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#111a2c',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {targetType === 'Node' ? (
                effectiveNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.type === 'port' ? '⚓' : n.type === 'warehouse' ? '📦' : n.type === 'hospital' ? '🏥' : '⚡'}{' '}
                    {n.name} {n.city ? `(${n.city})` : ''}
                  </option>
                ))
              ) : (
                effectiveLinks.map((l) => (
                  <option key={l.id} value={l.id}>
                    🛣️ {getShortTargetName(l.origin_id, l.origin_name)} &rarr;{' '}
                    {getShortTargetName(l.destination_id, l.destination_name)}{' '}
                    {l.distance_km ? `(${l.distance_km} km)` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 3. Days Closed Input */}
          <div>
            <label
              htmlFor="issue-days-closed"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Days Closed
            </label>
            <input
              id="issue-days-closed"
              type="number"
              min="1"
              max="90"
              value={daysClosed}
              onChange={(e) => setDaysClosed(Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#111a2c',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </div>

          {/* 4. Reason Text Input */}
          <div>
            <label
              htmlFor="issue-reason"
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Reason
            </label>
            <input
              id="issue-reason"
              type="text"
              placeholder="e.g. under construction, labor strike"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#111a2c',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* 5. Report Issue Button */}
          <div>
            <button
              type="submit"
              disabled={isEvaluating}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                borderColor: '#f43f5e',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isEvaluating ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(225, 29, 72, 0.35)',
              }}
            >
              <Plus size={15} />
              <span>Report Issue</span>
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            color: '#fb7185',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Active Issues Chips */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Disruption Issues ({activeIssues.length})
          </span>
          {activeIssues.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11px',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Clear all issues
            </button>
          )}
        </div>

        {activeIssues.length === 0 ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              fontSize: '12px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={14} color="#10b981" />
            <span>No active disruptions reported. All ports, warehouses, and transport corridors are operational.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {activeIssues.map((issue) => {
              const shortTarget = getShortTargetName(issue.targetId, issue.targetName);
              // Formatted chip text like: "Port A closed 5 days - under construction"
              const chipText = `${shortTarget} closed ${issue.daysClosed} day${
                issue.daysClosed === 1 ? '' : 's'
              }${issue.reason ? ` - ${issue.reason}` : ''}`;

              return (
                <div
                  key={issue.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 12px',
                    borderRadius: '9999px',
                    background: 'rgba(244, 63, 94, 0.16)',
                    border: '1px solid rgba(244, 63, 94, 0.38)',
                    color: '#fecdd3',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                    animation: 'fadeIn 0.2s ease-in',
                  }}
                >
                  <AlertOctagon size={13} color="#f43f5e" />
                  <span>{chipText}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveIssue(issue.id)}
                    title="Remove issue"
                    style={{
                      background: 'rgba(244, 63, 94, 0.3)',
                      border: '1px solid rgba(244, 63, 94, 0.5)',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#fff',
                      padding: 0,
                      marginLeft: '2px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e11d48';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(244, 63, 94, 0.3)';
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Small Summary Card for Alternate Route Status, Lead Time, Toll Cost */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={15} color="#38bdf8" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
              Alternate Route Contingency Impact Summary
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Dijkstra Multi-Criteria Evaluation (Hazira &rarr; Bhiwandi &rarr; Hospitals)
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '10px',
          }}
        >
          {/* Metric 1: Alternate Route Status */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Alternate Route Status
            </div>
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    currentAltStatus === 'ACTIVE_RECOMMENDED'
                      ? '#10b981'
                      : currentAltStatus === 'STANDBY_RESERVE'
                      ? '#38bdf8'
                      : '#f43f5e',
                  boxShadow: `0 0 6px ${
                    currentAltStatus === 'ACTIVE_RECOMMENDED'
                      ? '#10b981'
                      : currentAltStatus === 'STANDBY_RESERVE'
                      ? '#38bdf8'
                      : '#f43f5e'
                  }`,
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color:
                    currentAltStatus === 'ACTIVE_RECOMMENDED'
                      ? '#34d399'
                      : currentAltStatus === 'STANDBY_RESERVE'
                      ? '#38bdf8'
                      : '#fb7185',
                }}
              >
                {currentAltStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              {currentAltStatus === 'ACTIVE_RECOMMENDED'
                ? 'Primary severed; rerouting active'
                : 'Standby contingency corridor'}
            </div>
          </div>

          {/* Metric 2: Lead Time Days */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Lead Time Days
              </span>
              <Clock size={13} color="#38bdf8" />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {currentLeadTime} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>days transit</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              NH-48 corridor from Hazira
            </div>
          </div>

          {/* Metric 3: Toll Cost */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Toll Cost
              </span>
              <DollarSign size={13} color="#38bdf8" />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              ${currentTollCost.toLocaleString()}{' '}
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>per truck batch</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Gujarat-Maharashtra expressway toll
            </div>
          </div>

          {/* Metric 4: Distance KM */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Distance
              </span>
              <Navigation size={13} color="#38bdf8" />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
              {currentDistanceKm} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>km</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Hazira Port B to Bhiwandi Hub
            </div>
          </div>

          {/* Metric 4: Primary Route Status Reference */}
          {currentPrimRoute && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Primary Corridor (Port A)
              </div>
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: currentPrimRoute.status === 'OPERATIONAL' ? '#10b981' : '#f43f5e',
                  }}
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: currentPrimRoute.status === 'OPERATIONAL' ? '#34d399' : '#fb7185',
                  }}
                >
                  {currentPrimRoute.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                {currentPrimRoute.status === 'OPERATIONAL' ? '48 km • $25 toll • 1 day' : 'Corridor blocked or closed'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
