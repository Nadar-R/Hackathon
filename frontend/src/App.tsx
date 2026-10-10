import React, { useState, useEffect } from 'react';
import {
  fetchDemoData,
  runSimulation,
  runComparison,
  exportCSV,
} from './api/client';
import type {
  Dataset,
  IncidentScenario,
  MitigationOption,
  SimulationResult,
  ComparisonResult,
  Node,
} from './types';
import { NetworkGraph } from './components/NetworkGraph';
import { CalculationInspectorModal } from './components/CalculationInspectorModal';
import { ScenarioComparisonView } from './components/ScenarioComparisonView';
import { OutageBuilderModal } from './components/OutageBuilderModal';
import { MitigationBuilderModal } from './components/MitigationBuilderModal';
import { GoldenTestsVerifierModal } from './components/GoldenTestsVerifierModal';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { GeoRouteMap } from './components/GeoRouteMap';
import { SiemTelemetryModal } from './components/SiemTelemetryModal';
import { DaaLossMatrixCard } from './components/DaaLossMatrixCard';
import { FacilityEditorModal } from './components/FacilityEditorModal';
import {
  Activity,
  MapPin,
  Layers,
  GitCompare,
  Download,
  Printer,
  RotateCcw,
  Calculator,
  ShieldCheck,
  Package,
  Calendar,
  DollarSign,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Filter,
  FileCheck2,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Plus,
  Globe,
  Shield,
  Zap,
} from 'lucide-react';

export const App: React.FC = () => {
  // Benchmark Mode: Custom Multi-Echelon vs JNPT 2017 Baseline
  const [benchmarkMode, setBenchmarkMode] = useState<'custom_network' | 'jnpt_benchmark'>('custom_network');

  // Baseline JNPT State
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [scenario, setScenario] = useState<IncidentScenario | null>(null);
  const [mitigations, setMitigations] = useState<MitigationOption[]>([]);
  const [disabledMitigationIds, setDisabledMitigationIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'simulation' | 'compare' | 'network' | 'assumptions'>('simulation');

  // Custom Multi-Echelon Network State (Ports A/B, Warehouse X, Hospitals M/N, DC)
  const [customDataset, setCustomDataset] = useState<Dataset | null>(null);
  const [customScenario, setCustomScenario] = useState<IncidentScenario | null>(null);
  const [customMitigations, setCustomMitigations] = useState<MitigationOption[]>([]);
  const [portAActive, setPortAActive] = useState<boolean>(true);
  const [portBActive, setPortBActive] = useState<boolean>(false);
  const [daaData, setDaaData] = useState<any | null>(null);
  const [isSiemModalOpen, setIsSiemModalOpen] = useState<boolean>(false);
  const [activeAttackScenario, setActiveAttackScenario] = useState<string>('normal');

  // Simulation & Comparison State
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [compResult, setCompResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState<boolean>(false);

  // Table filtering & view modes
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<'all' | 'inbound' | 'outbound' | 'shortage'>('all');
  const [tableMode, setTableMode] = useState<'ledger' | 'daily_rollup'>('ledger');

  // Modals state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showOutageModal, setShowOutageModal] = useState<boolean>(false);
  const [showMitigationModal, setShowMitigationModal] = useState<boolean>(false);
  const [mitigationToEdit, setMitigationToEdit] = useState<MitigationOption | null>(null);
  const [showGoldenModal, setShowGoldenModal] = useState<boolean>(false);
  const [showFacilityEditor, setShowFacilityEditor] = useState<boolean>(false);
  const [inspectorData, setInspectorData] = useState<{ name: string; value: any } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load Baseline JNPT
      const demo = await fetchDemoData();
      setDataset(demo.dataset);
      setScenario(demo.scenario);
      setMitigations(demo.mitigations);
      setDisabledMitigationIds(new Set());

      const sim = await runSimulation(demo.dataset, demo.scenario, demo.mitigations, 10);
      setSimResult(sim);

      const comp = await runComparison(demo.dataset, demo.scenario, demo.mitigations, 10);
      setCompResult(comp);

      // 2. Load Custom Multi-Echelon Scenario
      const customRes = await fetch('http://127.0.0.1:8000/api/v1/custom-scenario');
      if (customRes.ok) {
        const customJson = await customRes.json();
        setCustomDataset(customJson.dataset);
        setCustomScenario(customJson.scenario);
        setCustomMitigations(customJson.mitigations);
      }

      // 3. Load DAA Dijkstra Routes
      await fetchDaaRoutes(true, false);

      triggerUpdatePill();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDaaRoutes = async (pA: boolean, pB: boolean) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/daa/routes?port_a_active=${pA}&port_b_active=${pB}`);
      if (res.ok) {
        const json = await res.json();
        setDaaData(json);
      }
    } catch (err) {
      console.error('Failed to fetch DAA routes:', err);
    }
  };

  const triggerUpdatePill = () => {
    setJustUpdated(true);
    setTimeout(() => setJustUpdated(false), 2500);
  };

  // Switch between Custom Network and JNPT baseline
  const handleSwitchMode = async (newMode: 'custom_network' | 'jnpt_benchmark') => {
    setBenchmarkMode(newMode);
    setLoading(true);
    try {
      if (newMode === 'custom_network' && customDataset && customScenario) {
        const activeMits = portBActive ? customMitigations : [];
        const sim = await runSimulation(customDataset, customScenario, activeMits, 10);
        setSimResult(sim);
        setSelectedFacility('node-warehouse-x');
      } else if (dataset && scenario) {
        const activeMits = mitigations.filter((m) => !disabledMitigationIds.has(m.id));
        const sim = await runSimulation(dataset, scenario, activeMits, 10);
        setSimResult(sim);
        setSelectedFacility('wh-mumbai-central');
      }
      triggerUpdatePill();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Recompute helper
  const recompute = async (
    currentDataset: Dataset,
    currentScenario: IncidentScenario,
    currentMitigations: MitigationOption[],
    currentDisabledIds: Set<string>
  ) => {
    setLoading(true);
    try {
      const activeMits = currentMitigations.filter((m) => !currentDisabledIds.has(m.id));
      const sim = await runSimulation(currentDataset, currentScenario, activeMits, 10);
      setSimResult(sim);
      const comp = await runComparison(currentDataset, currentScenario, activeMits, 10);
      setCompResult(comp);
      triggerUpdatePill();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyScenario = async (newScen: IncidentScenario) => {
    if (!dataset) return;
    setScenario(newScen);
    await recompute(dataset, newScen, mitigations, disabledMitigationIds);
  };

  const handleSaveMitigation = async (savedMit: MitigationOption) => {
    if (!dataset || !scenario) return;
    const exists = mitigations.some((m) => m.id === savedMit.id);
    const updated = exists
      ? mitigations.map((m) => (m.id === savedMit.id ? savedMit : m))
      : [...mitigations, savedMit];

    setMitigations(updated);
    setMitigationToEdit(null);
    await recompute(dataset, scenario, updated, disabledMitigationIds);
  };

  const handleToggleMitigation = async (id: string) => {
    if (!dataset || !scenario) return;
    const nextDisabled = new Set(disabledMitigationIds);
    if (nextDisabled.has(id)) {
      nextDisabled.delete(id);
    } else {
      nextDisabled.add(id);
    }
    setDisabledMitigationIds(nextDisabled);
    await recompute(dataset, scenario, mitigations, nextDisabled);
  };

  const handleDeleteMitigation = async (id: string) => {
    if (!dataset || !scenario) return;
    const updated = mitigations.filter((m) => m.id !== id);
    const nextDisabled = new Set(disabledMitigationIds);
    nextDisabled.delete(id);
    setMitigations(updated);
    setDisabledMitigationIds(nextDisabled);
    await recompute(dataset, scenario, updated, nextDisabled);
  };

  // Custom Network Cyber Attack Handler
  const handleTriggerAttack = async (scenarioType: string) => {
    setActiveAttackScenario(scenarioType);
    const isUnderAttack = scenarioType !== 'normal';
    const newPortAState = !isUnderAttack;
    setPortAActive(newPortAState);

    await fetchDaaRoutes(newPortAState, portBActive);

    if (customDataset && customScenario) {
      const updatedScenario: IncidentScenario = {
        ...customScenario,
        remaining_capacity_factor: newPortAState ? 1.0 : 0.0,
      };
      setCustomScenario(updatedScenario);
      const activeMits = portBActive ? customMitigations : [];
      const sim = await runSimulation(customDataset, updatedScenario, activeMits, 10);
      setSimResult(sim);
      triggerUpdatePill();
    }
  };

  const handleTogglePortBReroute = async () => {
    const nextPortBState = !portBActive;
    setPortBActive(nextPortBState);
    await fetchDaaRoutes(portAActive, nextPortBState);

    if (customDataset && customScenario) {
      const activeMits = nextPortBState ? customMitigations : [];
      const sim = await runSimulation(customDataset, customScenario, activeMits, 10);
      setSimResult(sim);
      triggerUpdatePill();
    }
  };

  const handleSaveCustomFacilities = async (updatedNodes: Node[]) => {
    setLoading(true);
    try {
      if (benchmarkMode === 'custom_network' && customDataset) {
        const newDataset: Dataset = {
          ...customDataset,
          nodes: updatedNodes,
        };
        setCustomDataset(newDataset);

        if (daaData) {
          const updatedMapNodes = updatedNodes.map((n) => ({
            id: n.id,
            name: n.name,
            type: (n as any).node_type || (n as any).type || 'warehouse',
            lat: (n as any).latitude ?? (n as any).lat ?? 19.076,
            lon: (n as any).longitude ?? (n as any).lon ?? 72.877,
            city: (n as any).city || (n.location_text ? n.location_text.split(',')[0] : 'Maharashtra'),
            criticality: n.criticality || 'high',
            status: 'normal' as const,
            notes: n.notes || '',
          }));

          const existingLinks = [...(daaData.map_links || [])];
          updatedNodes.forEach((n) => {
            const hasLink = existingLinks.some((l) => l.origin_id === n.id || l.destination_id === n.id);
            if (!hasLink) {
              existingLinks.push({
                id: `link-custom-${n.id}`,
                origin_id: 'node-warehouse-x',
                destination_id: n.id,
                origin_name: 'Bhiwandi Central Depot',
                destination_name: n.name,
                distance_km: 45,
                toll_cost: 120,
                freight_rate: 1.5,
                transit_days: 1,
                capacity: 1000,
                is_alternate: false,
                is_active_path: true,
                status: 'active',
              });
            }
          });

          setDaaData({
            ...daaData,
            map_nodes: updatedMapNodes,
            map_links: existingLinks,
          });
        }

        if (customScenario) {
          const activeMits = portBActive ? customMitigations : [];
          const sim = await runSimulation(newDataset, customScenario, activeMits, 10);
          setSimResult(sim);
        }
      } else if (dataset && scenario) {
        const newDataset: Dataset = {
          ...dataset,
          nodes: updatedNodes,
        };
        setDataset(newDataset);
        const activeMits = mitigations.filter((m) => !disabledMitigationIds.has(m.id));
        const sim = await runSimulation(newDataset, scenario, activeMits, 10);
        setSimResult(sim);
        const comp = await runComparison(newDataset, scenario, activeMits, 10);
        setCompResult(comp);
      }
      triggerUpdatePill();
    } catch (err: any) {
      setError(err.message || 'Failed to update facilities');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    const activeDataset = benchmarkMode === 'custom_network' ? customDataset : dataset;
    const activeScenario = benchmarkMode === 'custom_network' ? customScenario : scenario;
    const activeMits = benchmarkMode === 'custom_network'
      ? (portBActive ? customMitigations : [])
      : mitigations.filter((m) => !disabledMitigationIds.has(m.id));

    if (!activeDataset || !activeScenario) return;
    try {
      const blob = await exportCSV(activeDataset, activeScenario, activeMits, 10);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cyberchain_${benchmarkMode}_${simResult?.input_hash?.slice(0, 8) || 'export'}.csv`;
      a.click();
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  if (loading && !dataset && !customDataset) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>CyberSupply</div>
          <div style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Initializing deterministic supply chain simulation core...</div>
        </div>
      </div>
    );
  }

  // Filtered Events
  const events = simResult?.events || [];
  const filteredEvents = events.filter((ev) => {
    if (selectedFacility !== 'all' && ev.facility_id !== selectedFacility) return false;
    if (eventFilter === 'inbound' && ev.event_type !== 'inbound_consignment') return false;
    if (eventFilter === 'outbound' && ev.event_type !== 'outbound_dispatch') return false;
    if (eventFilter === 'shortage' && ev.event_type !== 'shortage') return false;
    return true;
  });

  // Filtered Daily Rollup Rows
  const dailyRows = (simResult?.daily_rows || []).filter((r) => {
    if (selectedFacility !== 'all' && r.node_id !== selectedFacility) return false;
    return true;
  });

  const currentActiveNodes = benchmarkMode === 'custom_network'
    ? (customDataset?.nodes || [])
    : (dataset?.nodes || []);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(2, 132, 199, 0.4)' }}>
                <Activity size={20} color="#fff" />
              </div>
              <h1 style={{ fontSize: '1.75rem', letterSpacing: '-0.03em', fontWeight: 800, color: '#fff', margin: 0 }}>
                Cyber<span style={{ color: '#38bdf8' }}>Supply</span>
              </h1>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Turn digital outages into transparent, inspectable supply-chain consequences.
          </p>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* SIEM Telemetry Console Launcher */}
          <button
            className="btn btn-primary"
            style={{
              background: activeAttackScenario !== 'normal'
                ? 'linear-gradient(135deg, #e11d48, #be123c)'
                : 'linear-gradient(135deg, #0284c7, #4f46e5)',
              borderColor: activeAttackScenario !== 'normal' ? '#f43f5e' : '#38bdf8',
            }}
            onClick={() => setIsSiemModalOpen(true)}
          >
            <Shield size={16} />
            <span>SIEM & Anomaly Console</span>
          </button>

          <button className="btn btn-secondary" onClick={() => setShowGoldenModal(true)} title="Run G1-G12 Tests">
            <ShieldCheck size={16} color="#10b981" />
            <span>Verify Golden Tests</span>
          </button>

          <button className="btn btn-secondary" onClick={loadAllData} title="Reset Data">
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>

          <button className="btn btn-secondary" onClick={handleExportCSV} title="Formula-Safe CSV Export">
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button className="btn btn-secondary" onClick={() => window.print()} title="Print Executive Brief">
            <Printer size={16} />
            <span>Print Report</span>
          </button>
        </div>
      </header>

      {/* Network Topology Switcher Strip */}
      <div style={{
        background: 'rgba(13, 19, 32, 0.7)',
        border: '1px solid rgba(56, 189, 248, 0.15)',
        borderRadius: '12px',
        padding: '10px 16px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
            Active Supply Chain Topology:
          </span>
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px', gap: '4px' }}>
            <button
              onClick={() => handleSwitchMode('custom_network')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: benchmarkMode === 'custom_network' ? '#0284c7' : 'transparent',
                color: benchmarkMode === 'custom_network' ? '#fff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Globe size={14} /> Custom Multi-Echelon Network (Ports A/B, Whse X, Hospitals M/N, DC)
            </button>
            <button
              onClick={() => handleSwitchMode('jnpt_benchmark')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: benchmarkMode === 'jnpt_benchmark' ? '#0284c7' : 'transparent',
                color: benchmarkMode === 'jnpt_benchmark' ? '#fff' : '#94a3b8',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Layers size={14} /> JNPT 2017 Baseline Benchmark
            </button>
          </div>

          <button
            onClick={() => setShowFacilityEditor(true)}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(56, 189, 248, 0.1)',
              borderColor: 'rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
            }}
            title="Edit building coordinates, names, or add new facilities"
          >
            <MapPin size={14} /> Edit Facilities &amp; Locations ({currentActiveNodes.length})
          </button>
        </div>

        {/* Live Calculation Indicator */}
        {justUpdated && (
          <span className="badge badge-confirmed" style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
            ✓ Deterministic Recomputation Complete
          </span>
        )}
      </div>

      {/* Main View: Custom Network Mode (Interactive Map + SIEM + DAA Loss Matrix) */}
      {benchmarkMode === 'custom_network' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Quick Cyber Incident Simulation Strip */}
          <div style={{
            background: activeAttackScenario !== 'normal'
              ? 'rgba(244, 63, 94, 0.12)'
              : 'rgba(11, 17, 30, 0.75)',
            border: `1px solid ${activeAttackScenario !== 'normal' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(56, 189, 248, 0.2)'}`,
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: activeAttackScenario !== 'normal' ? '#f43f5e' : '#10b981',
                boxShadow: `0 0 10px ${activeAttackScenario !== 'normal' ? '#f43f5e' : '#10b981'}`,
              }} />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                  {activeAttackScenario === 'ransomware'
                    ? 'CRITICAL ALERT: Ransomware Encrypted Data Center TOS DB (Primary Corridor Inflow: 0 units/day)'
                    : activeAttackScenario === 'ddos'
                    ? 'HIGH ALERT: Volumetric DDoS on Data Center API Gateway'
                    : 'System Status: Data Center Normal Baseline Telemetry'}
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '10px' }}>
                  Target: Central Logistics Data Center &bull; Dependent: Primary Terminal Inbound Corridor
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleTriggerAttack('normal')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: activeAttackScenario === 'normal' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                  background: activeAttackScenario === 'normal' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                  color: activeAttackScenario === 'normal' ? '#34d399' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Normal Traffic
              </button>
              <button
                onClick={() => handleTriggerAttack('ransomware')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: activeAttackScenario === 'ransomware' ? '1px solid #f43f5e' : '1px solid rgba(255,255,255,0.1)',
                  background: activeAttackScenario === 'ransomware' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255,255,255,0.04)',
                  color: activeAttackScenario === 'ransomware' ? '#fb7185' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Zap size={12} /> Inject Ransomware on Data Center
              </button>
              <button
                onClick={() => setIsSiemModalOpen(true)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #38bdf8',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View ML Telemetry Logs &rarr;
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Route Map */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} color="#38bdf8" />
                <span>Geographic Supply Chain Map & Corridors (Leaflet GIS)</span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Click nodes or route lines to view distance (km), transit lead times, and toll costs.
              </div>
            </div>
            <GeoRouteMap
              nodes={daaData?.map_nodes || []}
              links={daaData?.map_links || []}
              portAActive={portAActive}
              portBActive={portBActive}
              selectedNodeId={selectedFacility}
              onSelectNode={(nid) => setSelectedFacility(nid)}
              onOpenFacilityEditor={() => setShowFacilityEditor(true)}
            />
          </div>

          {/* DAA Loss Matrix & Reroute Evaluation Card */}
          <DaaLossMatrixCard
            daaData={daaData}
            onTogglePortB={handleTogglePortBReroute}
            onOpenSiemModal={() => setIsSiemModalOpen(true)}
          />
        </div>
      )}

      {/* Navigation Tabs (Available in JNPT baseline or secondary analysis) */}
      {benchmarkMode === 'jnpt_benchmark' && (
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'simulation' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulation')}
          >
            <Activity size={16} />
            <span>Operational Simulation</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            <GitCompare size={16} />
            <span>Mitigation Comparison</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            <Layers size={16} />
            <span>Dependency Graph</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'assumptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('assumptions')}
          >
            <FileCheck2 size={16} />
            <span>Assumptions &amp; Provenance</span>
          </button>
        </div>
      )}

      {/* Primary KPI Strip (In JNPT Benchmark Mode - Operational Simulation Tab) */}
      {benchmarkMode === 'jnpt_benchmark' && activeTab === 'simulation' && simResult && (
        <div className="grid-kpi" style={{ marginTop: '18px' }}>
          <div
            className="card-kpi cursor-pointer"
            onClick={() => setInspectorData({ name: 'Unmet Demand', value: simResult.kpis.unmet_units })}
            title="Click to audit calculation"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-kpi-label">Unmet Critical Demand</span>
              <Calculator size={16} color="var(--accent-cyan)" />
            </div>
            <div className={`card-kpi-value ${simResult.kpis.unmet_units > 0 ? 'card-kpi-value-danger' : 'card-kpi-value-success'}`}>
              {simResult.kpis.unmet_units.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 500 }}>cartons</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Fill rate: {simResult.kpis.fill_rate !== null ? `${(simResult.kpis.fill_rate * 100).toFixed(1)}%` : '100%'}
            </div>
          </div>

          <div
            className="card-kpi cursor-pointer"
            onClick={() => setInspectorData({ name: 'First Stockout Day', value: simResult.kpis.first_shortage_day })}
            title="Click to audit calculation"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-kpi-label">First Stockout Day</span>
              <Calendar size={16} color="var(--accent-cyan)" />
            </div>
            <div className={`card-kpi-value ${simResult.kpis.first_shortage_day ? 'card-kpi-value-danger' : 'card-kpi-value-success'}`}>
              {simResult.kpis.first_shortage_day ? `Day ${simResult.kpis.first_shortage_day}` : 'Never'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {simResult.kpis.first_shortage_day ? 'Critical supply exhausted' : 'Inventory buffer held'}
            </div>
          </div>

          <div
            className="card-kpi cursor-pointer"
            onClick={() => setInspectorData({ name: 'Ending Inventory', value: simResult.kpis.ending_stock })}
            title="Click to audit calculation"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-kpi-label">Ending Inventory Balance</span>
              <Package size={16} color="var(--accent-cyan)" />
            </div>
            <div className="card-kpi-value font-mono">
              {simResult.kpis.ending_stock.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 500 }}>units</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              At Day 10 horizon close
            </div>
          </div>

          <div
            className="card-kpi cursor-pointer"
            onClick={() => setInspectorData({ name: 'Response Cost', value: simResult.kpis.total_response_cost })}
            title="Click to audit calculation"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-kpi-label">Total Mitigation Cost</span>
              <DollarSign size={16} color="var(--accent-cyan)" />
            </div>
            <div className="card-kpi-value font-mono">
              ${(simResult.kpis.total_response_cost || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {mitigations.filter((m) => !disabledMitigationIds.has(m.id)).length} active mitigations
            </div>
          </div>
        </div>
      )}

      {/* Active Contingency Mitigations Card (JNPT Mode - Operational Simulation Tab) */}
      {benchmarkMode === 'jnpt_benchmark' && activeTab === 'simulation' && (
        <div className="glass-panel" style={{ padding: '16px 20px', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#38bdf8" />
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                Active Recovery &amp; Contingency Mitigations ({mitigations.length})
              </span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={() => { setMitigationToEdit(null); setShowMitigationModal(true); }}
            >
              <Plus size={13} color="#34d399" /> Add Mitigation
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
            {mitigations.map((mit) => {
              const isEnabled = !disabledMitigationIds.has(mit.id);
              return (
                <div
                  key={mit.id}
                  style={{
                    background: isEnabled ? 'rgba(56, 189, 248, 0.07)' : 'rgba(255, 255, 255, 0.02)',
                    border: isEnabled ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    opacity: isEnabled ? 1 : 0.55,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isEnabled ? '#f8fafc' : '#94a3b8' }}>
                        {mit.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
                        Day {mit.start_day} &bull; {mit.action_type === 'activate_link' ? 'Activate Link' : `+${mit.capacity_value} units/day`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => handleToggleMitigation(mit.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isEnabled ? '#10b981' : '#64748b' }}
                        title={isEnabled ? 'Disable mitigation' : 'Enable mitigation'}
                      >
                        {isEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button
                        onClick={() => { setMitigationToEdit(mit); setShowMitigationModal(true); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                        title="Edit mitigation"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteMitigation(mit.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#f43f5e' }}
                        title="Delete mitigation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {mit.assumption_note && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      "{mit.assumption_note}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operational Consignments & Movement Table (In Custom Network mode OR JNPT Simulation tab) */}
      {(benchmarkMode === 'custom_network' || (benchmarkMode === 'jnpt_benchmark' && activeTab === 'simulation')) && (
        <div className="glass-panel" style={{ padding: '24px', marginTop: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Operational Consignments &amp; Inventory Journal
              <span className="badge badge-confirmed" style={{ fontSize: '0.7rem' }}>
                <ShieldCheck size={12} /> Conservation Invariant Verified
              </span>
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
              Itemized record of distinct consignments arriving ($n$), departing ($m$), or quiescent stable days.
            </p>
          </div>

          {/* Table Controls */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#94a3b8" />
              <select
                style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
              >
                <option value="all">All Operational Facilities</option>
                {currentActiveNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '6px' }}>
              <button
                className={`filter-pill ${tableMode === 'ledger' ? 'active' : ''}`}
                onClick={() => setTableMode('ledger')}
              >
                Consignment Events
              </button>
              <button
                className={`filter-pill ${tableMode === 'daily_rollup' ? 'active' : ''}`}
                onClick={() => setTableMode('daily_rollup')}
              >
                Daily Rollup
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills for Ledger Mode */}
        {tableMode === 'ledger' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button
              className={`filter-pill ${eventFilter === 'all' ? 'active' : ''}`}
              onClick={() => setEventFilter('all')}
            >
              All Transactions ({filteredEvents.length})
            </button>
            <button
              className={`filter-pill ${eventFilter === 'inbound' ? 'active' : ''}`}
              onClick={() => setEventFilter('inbound')}
            >
              Inbound Consignments
            </button>
            <button
              className={`filter-pill ${eventFilter === 'outbound' ? 'active' : ''}`}
              onClick={() => setEventFilter('outbound')}
            >
              Outbound Dispatches
            </button>
            <button
              className={`filter-pill ${eventFilter === 'shortage' ? 'active' : ''}`}
              onClick={() => setEventFilter('shortage')}
            >
              Deficits &amp; Shortages
            </button>
          </div>
        )}

        {/* Ledger View Table */}
        {tableMode === 'ledger' ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>DAY</th>
                  <th style={{ width: '180px' }}>EVENT TYPE</th>
                  <th style={{ width: '220px' }}>FACILITY / NODE</th>
                  <th style={{ width: '240px' }}>LOGISTICS COUNTERPART</th>
                  <th style={{ width: '130px' }}>QTY DELTA</th>
                  <th style={{ width: '140px' }}>BALANCE AFTER</th>
                  <th>OPERATIONAL JOURNAL &amp; AUDIT NOTES</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)' }}>
                      No consignment transactions match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev, idx) => {
                    const isInbound = ev.event_type === 'inbound_consignment';
                    const isOutbound = ev.event_type === 'outbound_dispatch';
                    const isShortage = ev.event_type === 'shortage';
                    const isQuiescent = ev.event_type === 'quiescent';

                    return (
                      <tr key={idx} style={{ background: isShortage ? 'rgba(244, 63, 94, 0.08)' : undefined }}>
                        <td className="font-mono" style={{ fontWeight: 600 }}>Day {ev.day}</td>

                        <td>
                          {isInbound && (
                            <span className="badge badge-inbound">
                              <ArrowDownLeft size={13} /> Inbound Consignment
                            </span>
                          )}
                          {isOutbound && (
                            <span className="badge badge-outbound">
                              <ArrowUpRight size={13} /> Outbound Dispatch
                            </span>
                          )}
                          {isShortage && (
                            <span className="badge badge-shortage">
                              <AlertCircle size={13} /> Critical Deficit
                            </span>
                          )}
                          {isQuiescent && (
                            <span className="badge badge-quiescent">
                              <Clock size={13} /> No Activity
                            </span>
                          )}
                        </td>

                        <td style={{ fontWeight: 600, fontSize: '0.825rem' }}>
                          {ev.facility_name}
                        </td>

                        <td style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                          {ev.counterpart}
                        </td>

                        {/* Quantity Delta Color Coded: Inbound = Green, Outbound = Red */}
                        <td className="font-mono" style={{ fontWeight: 700 }}>
                          {ev.units_delta > 0 ? (
                            <span style={{ color: '#34d399' }}>+{ev.units_delta.toLocaleString()}</span>
                          ) : ev.units_delta < 0 ? (
                            <span style={{ color: '#fb7185' }}>{ev.units_delta.toLocaleString()}</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>0</span>
                          )}
                        </td>

                        <td className="font-mono" style={{ fontWeight: 700 }}>
                          {ev.balance_after.toLocaleString()} units
                        </td>

                        {/* Audit Description Color Coded: Inbound = Green, Outbound = Red, Quiescent = Muted */}
                        <td
                          style={{
                            fontSize: '0.8rem',
                            color: isInbound
                              ? '#34d399'
                              : isOutbound || isShortage
                              ? '#fb7185'
                              : 'var(--text-muted)',
                            fontWeight: isInbound || isOutbound ? 500 : 400,
                          }}
                        >
                          {ev.description}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Daily Rollup Table */
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>DAY</th>
                  <th>NODE / FACILITY</th>
                  <th>OPENING</th>
                  <th>INFLOW</th>
                  <th>LOCAL DEMAND</th>
                  <th>FULFILLED</th>
                  <th>UNMET</th>
                  <th>DISPATCHED</th>
                  <th>ENDING</th>
                  <th>CAPACITY FACTOR</th>
                  <th>AUDIT REASON</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row, idx) => (
                  <tr key={idx} style={{ background: row.unmet > 0 ? 'rgba(244, 63, 94, 0.08)' : undefined }}>
                    <td className="font-mono">Day {row.day}</td>
                    <td style={{ fontWeight: 600 }}>
                      {currentActiveNodes.find((n) => n.id === row.node_id)?.name || row.node_id}
                    </td>
                    <td className="font-mono">{row.opening_inventory.toLocaleString()}</td>
                    <td className="font-mono" style={{ color: (row.supply_added + row.arrivals_accepted) > 0 ? '#34d399' : undefined }}>
                      +{(row.supply_added + row.arrivals_accepted).toLocaleString()}
                    </td>
                    <td className="font-mono">{row.demand.toLocaleString()}</td>
                    <td className="font-mono" style={{ color: row.fulfilled > 0 ? '#34d399' : undefined }}>
                      {row.fulfilled.toLocaleString()}
                    </td>
                    <td className="font-mono" style={{ color: row.unmet > 0 ? '#fb7185' : undefined, fontWeight: row.unmet > 0 ? 700 : 400 }}>
                      {row.unmet.toLocaleString()}
                    </td>
                    <td className="font-mono" style={{ color: row.outbound_dispatched > 0 ? '#fb7185' : undefined }}>
                      {row.outbound_dispatched.toLocaleString()}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      {row.ending_inventory.toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${row.effective_capacity_factor < 1.0 ? 'badge-danger' : 'badge-confirmed'}`}>
                        {(row.effective_capacity_factor * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {row.impact_reasons.join('; ') || 'Normal'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Comparison View (JNPT Mode) */}
      {benchmarkMode === 'jnpt_benchmark' && activeTab === 'compare' && (
        compResult ? (
          <div style={{ marginTop: '18px' }}>
            <ScenarioComparisonView
              comparison={compResult}
              onOpenInspector={(metricName, val) => setInspectorData({ name: metricName, value: val })}
            />
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', marginTop: '18px' }}>
            <Activity className="spin" size={26} style={{ margin: '0 auto 10px', color: '#38bdf8' }} />
            <div style={{ color: '#f8fafc', fontWeight: 600 }}>Computing comparative scenario deltas...</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
              Auditing Baseline vs Active Mitigations.
            </div>
          </div>
        )
      )}

      {/* Network View (JNPT Mode) */}
      {benchmarkMode === 'jnpt_benchmark' && activeTab === 'network' && dataset && scenario && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '18px' }}>
          <NetworkGraph
            nodes={dataset.nodes}
            links={dataset.links}
            dependencies={dataset.dependencies}
            scenario={scenario}
            onSelectNode={(node) => setSelectedNode(node)}
            selectedNode={selectedNode}
          />
        </div>
      )}

      {/* Assumptions & Provenance View (JNPT Mode) */}
      {benchmarkMode === 'jnpt_benchmark' && activeTab === 'assumptions' && simResult && scenario && (
        <div style={{ marginTop: '18px' }}>
          <AssumptionsPanel
            inputHash={simResult.input_hash}
            engineVersion={simResult.engine_version}
            assumptions={simResult.assumptions}
            sourceUrl={scenario.source_url}
            sourceTitle={scenario.source_title}
          />
        </div>
      )}

      {/* Modals */}
      {/* SIEM Telemetry & Attack Console Modal */}
      <SiemTelemetryModal
        isOpen={isSiemModalOpen}
        onClose={() => setIsSiemModalOpen(false)}
        onTriggerDisruption={(scenarioType) => {
          handleTriggerAttack(scenarioType);
          setIsSiemModalOpen(false);
        }}
      />

      {showOutageModal && scenario && dataset && (
        <OutageBuilderModal
          scenario={scenario}
          nodes={dataset.nodes}
          onSave={handleApplyScenario}
          onClose={() => setShowOutageModal(false)}
        />
      )}

      {showMitigationModal && scenario && dataset && (
        <MitigationBuilderModal
          scenarioId={scenario.id}
          nodes={dataset.nodes}
          mitigationToEdit={mitigationToEdit}
          onSave={handleSaveMitigation}
          onClose={() => { setMitigationToEdit(null); setShowMitigationModal(false); }}
        />
      )}

      {showGoldenModal && (
        <GoldenTestsVerifierModal onClose={() => setShowGoldenModal(false)} />
      )}

      {showFacilityEditor && (
        <FacilityEditorModal
          isOpen={showFacilityEditor}
          onClose={() => setShowFacilityEditor(false)}
          nodes={benchmarkMode === 'custom_network' ? (customDataset?.nodes || []) : (dataset?.nodes || [])}
          onSaveFacilities={handleSaveCustomFacilities}
        />
      )}

      {inspectorData && simResult && (
        <CalculationInspectorModal
          metricName={inspectorData.name}
          metricValue={inspectorData.value}
          kpis={simResult.kpis}
          dailyRows={simResult.daily_rows}
          onClose={() => setInspectorData(null)}
        />
      )}
    </div>
  );
};

export default App;
