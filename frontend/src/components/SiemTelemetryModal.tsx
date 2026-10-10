import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Terminal, Zap, Key, X, CheckCircle2, ArrowRight, Search, Filter } from 'lucide-react';

interface TelemetryLog {
  id: string;
  timestamp: string;
  service_node_id: string;
  category: string;
  source_ip: string;
  destination_ip: string;
  event_name: string;
  cpu_percent: number;
  req_per_sec: number;
  failed_auths: number;
  disk_iops: number;
  latency_ms: number;
  anomaly_score: number;
  is_flagged: boolean;
  message: string;
}

interface IncidentSummary {
  attack_type: string;
  cve_reference: string;
  severity: string;
  confidence_score: number;
  target_service: string;
  impacted_downstream_node: string;
  physical_consequence: string;
  estimated_outage_days: number;
  recommended_action: string;
  executive_playbook: string;
}

interface SiemData {
  service_node_id: string;
  scenario: string;
  is_attack_active: boolean;
  max_anomaly_score: number;
  flagged_events_count: number;
  incident_summary?: IncidentSummary;
  telemetry_logs: TelemetryLog[];
}

interface SiemTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerDisruption: (attackScenario: string, incidentSummary?: IncidentSummary) => void;
}

export const SiemTelemetryModal: React.FC<SiemTelemetryModalProps> = ({
  isOpen,
  onClose,
  onTriggerDisruption,
}) => {
  const [activeScenario, setActiveScenario] = useState<string>('normal');
  const [data, setData] = useState<SiemData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyAnomalies, setOnlyAnomalies] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<TelemetryLog | null>(null);

  const fetchTelemetry = async (scenario: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/siem/telemetry?attack_scenario=${scenario}&count=20`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch SIEM telemetry:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry(activeScenario);
    }
  }, [isOpen, activeScenario]);

  if (!isOpen) return null;

  const logs = data?.telemetry_logs || [];
  const filteredLogs = logs.filter((log) => {
    if (onlyAnomalies && !log.is_flagged) return false;
    if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        log.event_name.toLowerCase().includes(query) ||
        log.source_ip.toLowerCase().includes(query) ||
        log.destination_ip.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(2, 6, 17, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: '#0a0f1d',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.85), 0 0 35px rgba(56, 189, 248, 0.15)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1080px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.7)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: data?.is_attack_active ? 'rgba(244, 63, 94, 0.2)' : 'rgba(56, 189, 248, 0.15)',
              border: `1px solid ${data?.is_attack_active ? '#f43f5e' : '#38bdf8'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: data?.is_attack_active ? '#f43f5e' : '#38bdf8',
            }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Security Information &amp; ML Telemetry Console
              </h2>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                Target: Terminal Operating Infrastructure &bull; Model: Scikit-Learn IsolationForest Anomaly Scorer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scenario Trigger Bar */}
          <div style={{
            background: 'rgba(11, 17, 30, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
              Simulate Threat Vectors:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setActiveScenario('normal'); fetchTelemetry('normal'); }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeScenario === 'normal' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeScenario === 'normal' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeScenario === 'normal' ? '#34d399' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={14} /> Normal Baseline
              </button>
              <button
                onClick={() => { setActiveScenario('ransomware'); fetchTelemetry('ransomware'); }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeScenario === 'ransomware' ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeScenario === 'ransomware' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeScenario === 'ransomware' ? '#fb7185' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} /> Ransomware DB Encryption
              </button>
              <button
                onClick={() => { setActiveScenario('ddos'); fetchTelemetry('ddos'); }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeScenario === 'ddos' ? '1px solid #fb923c' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeScenario === 'ddos' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeScenario === 'ddos' ? '#fdba74' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Zap size={14} /> Volumetric DDoS Flood
              </button>
              <button
                onClick={() => { setActiveScenario('credential_stuffing'); fetchTelemetry('credential_stuffing'); }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: activeScenario === 'credential_stuffing' ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeScenario === 'credential_stuffing' ? 'rgba(192, 132, 252, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeScenario === 'credential_stuffing' ? '#e9d5ff' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Key size={14} /> Credential Stuffing
              </button>
            </div>
          </div>

          {/* Anomaly Gauge & Status Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 2fr',
            gap: '16px',
          }}>
            {/* IsolationForest Metric Card */}
            <div style={{
              background: 'rgba(13, 19, 32, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
                  IsolationForest Anomaly Score
                </div>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  marginTop: '6px',
                  color: (data?.max_anomaly_score || 0) > 0.65 ? '#f43f5e' : '#10b981',
                }}>
                  {data?.max_anomaly_score !== undefined ? data.max_anomaly_score.toFixed(3) : '0.000'}
                </div>
                <div style={{
                  height: '8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  marginTop: '10px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (data?.max_anomaly_score || 0) * 100)}%`,
                    background: (data?.max_anomaly_score || 0) > 0.65
                      ? 'linear-gradient(90deg, #fb923c, #f43f5e)'
                      : 'linear-gradient(90deg, #38bdf8, #10b981)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
              <div style={{ marginTop: '14px', fontSize: '12px', color: '#94a3b8' }}>
                Flagged events: <strong style={{ color: '#f8fafc' }}>{data?.flagged_events_count || 0} / {logs.length}</strong>
              </div>
            </div>

            {/* Incident Summary Card */}
            <div style={{
              background: data?.is_attack_active ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.08)',
              border: `1px solid ${data?.is_attack_active ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`,
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              {data?.incident_summary ? (
                <>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: '#f43f5e',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}>
                        {data.incident_summary.severity} ALERT
                      </span>
                      <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                        Confidence: {(data.incident_summary.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginTop: '8px', margin: '8px 0 0 0' }}>
                      {data.incident_summary.attack_type}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.4, margin: '4px 0 0 0' }}>
                      {data.incident_summary.physical_consequence}
                    </p>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                      CVE / Threat Ref: <code style={{ color: '#38bdf8' }}>{data.incident_summary.cve_reference}</code>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onTriggerDisruption(activeScenario, data.incident_summary)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: '#f43f5e',
                        color: '#fff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(244, 63, 94, 0.4)',
                      }}
                    >
                      Apply Threat Impact &amp; Calculate Optimal Contingency Route <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '12px' }}>
                  <CheckCircle2 size={32} color="#10b981" />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      All Services Operating Normally
                    </h4>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                      Baseline network traffic, authentication flows, and automated terminal gate transactions are within normal statistical thresholds.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Log Search & Filtering Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search event names, IPs, payload messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '12px',
                  width: '100%',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Filter size={13} color="#94a3b8" />
              {(['all', 'PROCESS', 'DATABASE', 'NETWORK', 'AUTH', 'API_GATEWAY'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '5px',
                    border: 'none',
                    background: selectedCategory === cat ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                    color: selectedCategory === cat ? '#fff' : '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {cat}
                </button>
              ))}

              <button
                onClick={() => setOnlyAnomalies(!onlyAnomalies)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '5px',
                  border: onlyAnomalies ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: onlyAnomalies ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                  color: onlyAnomalies ? '#fb7185' : '#94a3b8',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
              >
                Anomalies Only ({data?.flagged_events_count || 0})
              </button>
            </div>
          </div>

          {/* Terminal Log Stream */}
          <div style={{
            background: '#040711',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: '#94a3b8',
              fontFamily: 'monospace',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={14} color="#38bdf8" />
                <span>LOG STREAM: /var/log/terminal-gateway.log ({filteredLogs.length} events)</span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Click row for telemetry drill-down</span>
            </div>
            <div style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              {filteredLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                  No telemetry entries match the current filter.
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(isSelected ? null : log)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 90px 140px 1fr 60px',
                        gap: '10px',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: isSelected
                          ? 'rgba(56, 189, 248, 0.15)'
                          : log.is_flagged
                          ? 'rgba(244, 63, 94, 0.12)'
                          : 'transparent',
                        borderLeft: log.is_flagged ? '3px solid #f43f5e' : '3px solid transparent',
                        color: log.is_flagged ? '#fb7185' : '#94a3b8',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <span style={{ color: '#64748b' }}>{log.timestamp}</span>
                      <span style={{ color: '#38bdf8' }}>[{log.category}]</span>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{log.event_name}</span>
                      <span style={{ color: log.is_flagged ? '#fecdd3' : '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.message}
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 700, color: log.is_flagged ? '#f43f5e' : '#10b981' }}>
                        {log.anomaly_score.toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drilldown Drawer for Selected Log */}
            {selectedLog && (
              <div style={{
                borderTop: '1px solid rgba(56, 189, 248, 0.2)',
                background: 'rgba(15, 23, 42, 0.95)',
                padding: '12px 16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                fontSize: '11px',
                color: '#cbd5e1',
              }}>
                <div><strong>Source IP:</strong> <code style={{ color: '#38bdf8' }}>{selectedLog.source_ip}</code></div>
                <div><strong>Dest IP:</strong> <code style={{ color: '#38bdf8' }}>{selectedLog.destination_ip}</code></div>
                <div><strong>CPU Load:</strong> {selectedLog.cpu_percent}%</div>
                <div><strong>Throughput:</strong> {selectedLog.req_per_sec} req/s</div>
                <div><strong>Failed Auths:</strong> {selectedLog.failed_auths}</div>
                <div><strong>Disk IOPS:</strong> {selectedLog.disk_iops}</div>
                <div><strong>Latency:</strong> {selectedLog.latency_ms} ms</div>
                <div><strong>ML Score:</strong> <span style={{ color: selectedLog.is_flagged ? '#f43f5e' : '#10b981', fontWeight: 700 }}>{selectedLog.anomaly_score}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
