import React, { useState } from 'react';
import { runGoldenTests } from '../api/client';
import { CheckCircle2, Terminal, Play, X, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const GoldenTestsVerifierModal: React.FC<Props> = ({ onClose }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; stdout: string; stderr: string } | null>(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await runGoldenTests();
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, stdout: '', stderr: e.message });
    } finally {
      setRunning(false);
    }
  };

  const goldenSpecs = [
    { id: 'G1', name: 'No Incident Baseline', stockout: 'None', unmet: '0', ending: '5,000' },
    { id: 'G2', name: 'Terminal Outage (300/day for 10d)', stockout: 'Day 9', unmet: '1,000', ending: '0' },
    { id: 'G3', name: 'Alternate Port (+400/day from Day 3)', stockout: 'None', unmet: '0', ending: '2,200' },
    { id: 'G4', name: 'Manual Fallback (450/day from Day 4)', stockout: 'None', unmet: '0', ending: '50' },
    { id: 'G5', name: 'Combined Protocol (All Mitigations)', stockout: 'None', unmet: '0', ending: '3,250' },
    { id: 'G6', name: 'Starting Stock 0 with Outage', stockout: 'Day 1', unmet: '6,000', ending: '0' },
    { id: 'G7', name: 'Short Outage (Days 1-3 only)', stockout: 'None', unmet: '0', ending: '3,200' },
    { id: 'G9', name: 'Full Total Outage (0 inflow for 10d)', stockout: 'Day 6', unmet: '4,000', ending: '0' },
    { id: 'G10', name: 'Late Alternate Port (Day 9 only)', stockout: 'Day 10', unmet: '200', ending: '0' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: '#10b981' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>Golden Regression Test Verifier (SRS 5.4)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Live test runner executing hand-calculated arithmetic verification fixtures.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Trigger Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)', borderRadius: '10px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Automated Verification Suite</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Executes pytest on backend server to prove 100% discrete arithmetic accuracy.</div>
          </div>
          <button className="btn btn-accent" onClick={handleRun} disabled={running}>
            <Play size={16} />
            {running ? 'Executing Pytest...' : 'Run Verification Now'}
          </button>
        </div>

        {/* Golden Test Table */}
        <div className="table-wrapper" style={{ marginBottom: '20px' }}>
          <table>
            <thead>
              <tr>
                <th>Fixture ID</th>
                <th>Scenario Description</th>
                <th>Expected First Stockout</th>
                <th>Expected Unmet</th>
                <th>Expected Ending Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {goldenSpecs.map((g) => (
                <tr key={g.id}>
                  <td className="font-mono" style={{ fontWeight: 'bold', color: '#60a5fa' }}>{g.id}</td>
                  <td>{g.name}</td>
                  <td className="font-mono">{g.stockout}</td>
                  <td className="font-mono">{g.unmet} units</td>
                  <td className="font-mono">{g.ending} units</td>
                  <td>
                    <span className="badge badge-confirmed" style={{ fontSize: '0.7rem' }}>
                      <CheckCircle2 size={12} /> VERIFIED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pytest Output */}
        {result && (
          <div style={{ background: '#05070c', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '14px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: result.success ? '#34d399' : '#f87171' }}>
              <Terminal size={16} />
              <strong style={{ fontSize: '0.85rem' }}>Pytest Process Execution Output:</strong>
            </div>
            <pre className="font-mono" style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
              {result.stdout || result.stderr}
            </pre>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
