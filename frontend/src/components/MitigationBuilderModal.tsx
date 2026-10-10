import React, { useState, useEffect } from 'react';
import type { MitigationOption, ActionType, MitigationCombineMode, Node } from '../types';
import { X, ShieldCheck, Check } from 'lucide-react';

interface Props {
  onSave: (mitigation: MitigationOption) => void;
  onClose: () => void;
  scenarioId: string;
  nodes: Node[];
  mitigationToEdit?: MitigationOption | null;
}

export const MitigationBuilderModal: React.FC<Props> = ({
  onSave,
  onClose,
  scenarioId,
  nodes,
  mitigationToEdit,
}) => {
  const [formData, setFormData] = useState<Partial<MitigationOption>>({
    id: mitigationToEdit?.id || `mit-${Date.now().toString().slice(-4)}`,
    scenario_id: scenarioId,
    name: mitigationToEdit?.name || 'Alternate Emergency Route',
    action_type: mitigationToEdit?.action_type || 'capacity_override',
    target_node_id: mitigationToEdit?.target_node_id || 'wh-mumbai-central',
    start_day: mitigationToEdit?.start_day ?? 3,
    end_day: mitigationToEdit?.end_day ?? null,
    capacity_effect: mitigationToEdit?.capacity_effect || 'add',
    capacity_value: mitigationToEdit?.capacity_value ?? 400,
    setup_cost: mitigationToEdit?.setup_cost ?? 5000,
    variable_cost_per_unit: mitigationToEdit?.variable_cost_per_unit ?? 10,
    assumption_note: mitigationToEdit?.assumption_note || 'Contracted secondary logistics provider activated from day 3.',
  });

  useEffect(() => {
    if (mitigationToEdit) {
      setFormData({ ...mitigationToEdit });
    }
  }, [mitigationToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.assumption_note) {
      onSave(formData as MitigationOption);
      onClose();
    }
  };

  const operationalNodes = nodes.filter((n) => n.node_type !== 'digital_service');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: '#10b981' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>
                {mitigationToEdit ? 'Edit Recovery Mitigation' : 'Add Recovery Mitigation'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Configure alternate route activation, manual fallback, or capacity injections.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Mitigation Label / Strategy Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Target Facility / Node</label>
              <select
                value={formData.target_node_id || ''}
                onChange={(e) => setFormData({ ...formData, target_node_id: e.target.value })}
                required
              >
                {operationalNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.node_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Action Type</label>
              <select
                value={formData.action_type}
                onChange={(e) => setFormData({ ...formData, action_type: e.target.value as ActionType })}
              >
                <option value="capacity_override">Capacity Override / Fallback</option>
                <option value="activate_link">Activate Secondary Link</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Effect Mechanism (Add vs Replace)</label>
              <select
                value={formData.capacity_effect}
                onChange={(e) => setFormData({ ...formData, capacity_effect: e.target.value as MitigationCombineMode })}
              >
                <option value="add">Add (+ units on top of existing)</option>
                <option value="replace">Replace (substitutes degraded throughput)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Capacity Impact (units/day)</label>
              <input
                type="number"
                min="0"
                value={formData.capacity_value}
                onChange={(e) => setFormData({ ...formData, capacity_value: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Activation Start Day</label>
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
              <label>End Day (Optional)</label>
              <input
                type="number"
                min="1"
                max="90"
                placeholder="Leave blank for entire horizon"
                value={formData.end_day ?? ''}
                onChange={(e) => setFormData({ ...formData, end_day: e.target.value ? parseInt(e.target.value) : null })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>One-Time Setup Cost ($)</label>
              <input
                type="number"
                min="0"
                value={formData.setup_cost ?? ''}
                placeholder="Optional"
                onChange={(e) => setFormData({ ...formData, setup_cost: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>

            <div className="form-group">
              <label>Variable Cost / Unit ($)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.variable_cost_per_unit ?? ''}
                placeholder="Optional"
                onChange={(e) => setFormData({ ...formData, variable_cost_per_unit: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Mandatory Assumption Note (SRS FR-503)</label>
            <textarea
              rows={2}
              placeholder="State why this mitigation is viable and operational requirements..."
              value={formData.assumption_note}
              onChange={(e) => setFormData({ ...formData, assumption_note: e.target.value })}
              required
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-accent">
              <Check size={16} /> {mitigationToEdit ? 'Save Changes' : 'Add Mitigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
