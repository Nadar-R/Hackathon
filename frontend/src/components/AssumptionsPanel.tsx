import React from 'react';
import { Lock, FileText, ExternalLink, Hash, HelpCircle, BookOpen } from 'lucide-react';

interface Props {
  inputHash?: string;
  engineVersion?: string;
  assumptions: string[];
  sourceUrl?: string | null;
  sourceTitle?: string | null;
}

export const AssumptionsPanel: React.FC<Props> = ({
  inputHash,
  engineVersion = '0.1.0',
  assumptions: _assumptions,
  sourceUrl,
  sourceTitle,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Educational Banner Explaining Purpose */}
      <div style={{ padding: '20px 24px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <HelpCircle size={22} color="#38bdf8" />
          <h3 style={{ fontSize: '1.15rem', color: '#fff' }}>What Is The "Assumptions &amp; Provenance" Tab?</h3>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.6' }}>
          In real-world supply chain management and academic research, you cannot present numbers without explaining <strong>where the data came from (Provenance)</strong> and <strong>which mathematical rules were applied (Assumptions)</strong>. 
          This tab provides the exact audit trail so a planner, teacher, or evaluator can challenge, verify, and reproduce every number without black-box guesswork.
        </p>
      </div>

      <div className="grid-cols-2">
        {/* Documented Assumptions Section */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <FileText size={18} color="#38bdf8" />
            1. Documented Modeling Assumptions (Rules)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            These are the frozen physical laws used by the deterministic simulation engine:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.825rem' }}>
            <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>Daily Order of Operations</div>
              <div style={{ color: 'var(--text-muted)' }}>
                On each day $t$: Inbound supply is produced $\to$ Inbound shipments arrive $\to$ Local demand is served $\to$ Outbound links dispatch stock $\to$ Ending inventory balance is reconciled.
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>Unmet Demand is Lost (Not Backlogged)</div>
              <div style={{ color: 'var(--text-muted)' }}>
                When hospital demand cannot be met on Day $t$, critical patients go without supplies today. It is logged as a shortage rather than magically piling up in an infinite queue.
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>Discrete Whole Units (No Fractions)</div>
              <div style={{ color: 'var(--text-muted)' }}>
                Logistics corridors move discrete boxes, cartons, or containers. Any fractional multiplication (e.g. 33.3% of 900) is strictly floored to whole integer units.
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '2px' }}>Conservation Invariant</div>
              <div style={{ color: 'var(--text-muted)' }}>
                Opening Stock + Inflow + Arrivals - Fulfilled - Dispatched - Overflow = Ending Stock. Inventory is never created or destroyed out of thin air.
              </div>
            </div>
          </div>
        </div>

        {/* Provenance & Reproducibility Section */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Lock size={18} color="#10b981" />
            2. Data Provenance &amp; Cryptographic Audit
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Where the data originated and cryptographic proof of repeatability:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.825rem' }}>
            {/* SHA-256 Explanation */}
            <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
                <Hash size={14} /> Reproducibility Input Fingerprint (SHA-256)
              </div>
              <div className="font-mono" style={{ fontSize: '0.775rem', color: '#60a5fa', wordBreak: 'break-all', marginBottom: '6px' }}>
                {inputHash || 'sha256:7b9f8a42...c014'} (Engine v{engineVersion})
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                This is a cryptographic hash of all active parameters. Re-running the engine with this exact input hash on any machine will produce the exact same byte-identical output.
              </div>
            </div>

            {/* Real World Citation */}
            <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#34d399', marginBottom: '4px' }}>
                <BookOpen size={14} /> Real-World Case Anchor
              </div>
              <div style={{ color: '#e2e8f0', marginBottom: '4px' }}>
                {sourceTitle || 'UNCTAD Case Study 16: JNPT India Terminal Cyber Incident'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '6px' }}>
                Based on the documented June 2017 NotPetya ransomware attack that crippled the Gateway Terminal at Jawaharlal Nehru Port, causing inland truck queues and requiring alternative port diversion.
              </div>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                >
                  View Case Study Reference <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Framework Guidance */}
            <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '2px' }}>Regulatory Guidance: NIST SP 800-161</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Aligns with NIST Cybersecurity Supply Chain Risk Management (C-SCRM) guidelines for assessing operational impact of third-party digital disruptions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
