import React, { useState } from 'react';
import type { IncidentScenario, Node, CapacityMode, SourceStatus } from '../types';
import { X, Flame, Check } from 'lucide-react';

interface Props {
  scenario: IncidentScenario;
  nodes: Node[];
  onSave: (scenario: IncidentScenario) => void;
  onClose: () => void;
}

export const OutageBuilderModal: React.FC<Props> = ({
  scenario,
  nodes,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<IncidentScenario>({ ...scenario });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '8px', color: '#f87171' }}>
              <Flame size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>Configure Disruption Scenario</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Define outage duration, remaining capacity, and evidence provenance.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Scenario Title</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Target Node / System</label>
              <select
                value={formData.target_node_id}
                onChange={(e) => setFormData({ ...formData, target_node_id: e.target.value })}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.node_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Evidence Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as SourceStatus })}
              >
                <option value="hypothetical">Hypothetical Simulation</option>
                <option value="confirmed_public">Confirmed Public Incident</option>
                <option value="synthetic">Synthetic Baseline</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Start Day (Integer &gt;= 1)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={formData.start_day}
                onChange={(e) => setFormData({ ...formData, start_day: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="form-group">
              <label>Outage Duration (Days)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 1 })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Capacity Mode</label>
              <select
                value={formData.capacity_mode}
                onChange={(e) => setFormData({ ...formData, capacity_mode: e.target.value as CapacityMode })}
              >
                <option value="absolute">Absolute Inflow (units/day)</option>
                <option value="multiplier">Fractional Multiplier (0.0 to 1.0)</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                {formData.capacity_mode === 'absolute' ? 'Throughput (units/day)' : 'Remaining Capacity Factor'}
              </label>
              {formData.capacity_mode === 'absolute' ? (
                <input
                  type="number"
                  min="0"
                  value={formData.absolute_capacity_value ?? 300}
                  onChange={(e) => setFormData({ ...formData, absolute_capacity_value: parseInt(e.target.value) || 0 })}
                  required
                />
              ) : (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.remaining_capacity_factor}
                  onChange={(e) => setFormData({ ...formData, remaining_capacity_factor: parseFloat(e.target.value) || 0 })}
                  required
                />
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Source Reference URL (Optional / Provenance)</label>
            <input
              type="text"
              placeholder="e.g. https://resilientmaritimelogistics.unctad.org/..."
              value={formData.source_url || ''}
              onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Assumptions Note (Visible to Planners &amp; Evaluators)</label>
            <textarea
              rows={2}
              value={formData.assumptions_note}
              onChange={(e) => setFormData({ ...formData, assumptions_note: e.target.value })}
              required
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} /> Save &amp; Apply Scenario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
