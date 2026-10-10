import React, { useState } from 'react';
import { X, Plus, Trash2, MapPin, Building, Anchor, Package, HeartPulse, Zap, Check } from 'lucide-react';
import type { Node as DomainNode } from '../types';

export interface EditableFacility {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  city: string;
  criticality: string;
  notes?: string;
  daily_demand?: number;
  starting_stock?: number;
}

interface FacilityEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: DomainNode[];
  onSaveFacilities: (updatedNodes: DomainNode[]) => void;
}

const PRESET_LOCATIONS: { name: string; city: string; lat: number; lon: number }[] = [
  { name: 'Navi Mumbai (JNPT Gateway)', city: 'Navi Mumbai', lat: 18.9499, lon: 72.9511 },
  { name: 'Hazira Container Port', city: 'Surat', lat: 21.0963, lon: 72.6416 },
  { name: 'Bhiwandi Central Depot', city: 'Bhiwandi', lat: 19.2969, lon: 73.0631 },
  { name: 'Central Mumbai (Apex Memorial)', city: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Pune East Trauma Center', city: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Pimpri-Chinchwad Medical Hub', city: 'Pimpri', lat: 18.6298, lon: 73.7997 },
  { name: 'Thane Central Hospital', city: 'Thane', lat: 19.2183, lon: 72.9781 },
  { name: 'Nashik Pharma Logistics Zone', city: 'Nashik', lat: 19.9975, lon: 73.7898 },
  { name: 'South Mumbai Port Terminal', city: 'Mumbai', lat: 18.9220, lon: 72.8347 },
  { name: 'Panvel Multi-Modal Cargo Hub', city: 'Panvel', lat: 18.9894, lon: 73.1175 },
];

export const FacilityEditorModal: React.FC<FacilityEditorModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onSaveFacilities,
}) => {
  if (!isOpen) return null;

  const [facilities, setFacilities] = useState<EditableFacility[]>(() => {
    return nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.node_type || (n as any).type || 'warehouse',
      lat: (n as any).latitude ?? (n as any).lat ?? 19.076,
      lon: (n as any).longitude ?? (n as any).lon ?? 72.877,
      city: (n as any).city || (n.location_text ? n.location_text.split(',')[0] : 'Maharashtra'),
      criticality: n.criticality || 'high',
      notes: n.notes || '',
    }));
  });

  const [activeTab, setActiveTab] = useState<'all' | 'ports' | 'warehouses' | 'hospitals'>('all');

  const handleUpdate = (id: string, field: keyof EditableFacility, val: any) => {
    setFacilities((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: val } : f))
    );
  };

  const handleApplyPreset = (id: string, presetName: string) => {
    const found = PRESET_LOCATIONS.find((p) => p.name === presetName);
    if (!found) return;
    setFacilities((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, city: found.city, lat: found.lat, lon: found.lon }
          : f
      )
    );
  };

  const handleAddFacility = () => {
    const newIdx = facilities.length + 1;
    const newId = `node-custom-facility-${Date.now().toString().slice(-4)}`;
    const newFacility: EditableFacility = {
      id: newId,
      name: `Healthcare Facility ${newIdx} (New Location)`,
      type: 'hospital',
      lat: 18.6298,
      lon: 73.7997,
      city: 'Pimpri-Chinchwad',
      criticality: 'high',
      notes: 'Custom emergency delivery location calibrated on road network.',
    };
    setFacilities((prev) => [...prev, newFacility]);
  };

  const handleDeleteFacility = (id: string) => {
    if (facilities.length <= 2) {
      alert('The network requires at least 2 facilities (an origin and destination) to simulate logistics.');
      return;
    }
    setFacilities((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = () => {
    const domainNodes: DomainNode[] = facilities.map((f) => ({
      id: f.id,
      name: f.name,
      node_type: f.type as any,
      criticality: f.criticality as any,
      location_text: `${f.city}, India`,
      region_code: 'IN-MH',
      source_status: 'confirmed_public' as any,
      notes: f.notes,
      latitude: f.lat,
      longitude: f.lon,
      city: f.city,
    } as any));

    onSaveFacilities(domainNodes);
    onClose();
  };

  const filteredFacilities = facilities.filter((f) => {
    if (activeTab === 'ports') return f.type === 'port';
    if (activeTab === 'warehouses') return f.type === 'warehouse';
    if (activeTab === 'hospitals') return f.type === 'hospital';
    return true;
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'port':
        return <Anchor size={15} color="#38bdf8" />;
      case 'warehouse':
        return <Package size={15} color="#a855f7" />;
      case 'hospital':
        return <HeartPulse size={15} color="#34d399" />;
      case 'digital_service':
        return <Zap size={15} color="#f59e0b" />;
      default:
        return <Building size={15} color="#94a3b8" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(15, 23, 42, 0.98)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '10px', color: '#38bdf8' }}>
              <MapPin size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700, margin: 0 }}>
                Facility &amp; Building Location Editor
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Add, remove, or reposition buildings, ports, depots, and hospitals. Real highway road routes dynamically calibrate to these coordinates.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px' }}>
            {(['all', 'ports', 'warehouses', 'hospitals'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === tab ? '#0284c7' : 'transparent',
                  color: activeTab === tab ? '#fff' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'all' ? `All (${facilities.length})` : tab}
              </button>
            ))}
          </div>

          <button
            onClick={handleAddFacility}
            className="btn btn-secondary"
            style={{
              fontSize: '12px',
              padding: '6px 14px',
              background: 'rgba(16, 185, 129, 0.15)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} /> Add Building / Facility
          </button>
        </div>

        {/* Scrollable Facility List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '6px' }}>
          {filteredFacilities.map((fac, idx) => (
            <div
              key={fac.id}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {/* Row 1: Facility Name, Type, Criticality, Delete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '160px' }}>
                  {getIconForType(fac.type)}
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>#{idx + 1}</span>
                  <select
                    value={fac.type}
                    onChange={(e) => handleUpdate(fac.id, 'type', e.target.value)}
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                    }}
                  >
                    <option value="port">⚓ Sea / Container Port</option>
                    <option value="warehouse">📦 Distribution Warehouse</option>
                    <option value="hospital">🏥 Super-Speciality Hospital</option>
                    <option value="clinic">🩺 Regional Clinic</option>
                    <option value="digital_service">⚡ Cloud &amp; TOS Data Center</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={fac.name}
                  onChange={(e) => handleUpdate(fac.id, 'name', e.target.value)}
                  placeholder="Facility Name"
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    padding: '6px 10px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                />

                <select
                  value={fac.criticality}
                  onChange={(e) => handleUpdate(fac.id, 'criticality', e.target.value)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: fac.criticality === 'critical' ? '#fb7185' : '#38bdf8',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <option value="critical">CRITICAL</option>
                  <option value="high">HIGH</option>
                  <option value="medium">MEDIUM</option>
                  <option value="low">LOW</option>
                </select>

                <button
                  onClick={() => handleDeleteFacility(fac.id)}
                  style={{
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#fb7185',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                  title="Remove facility"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Row 2: City, Latitude, Longitude, Presets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>City / Region</label>
                  <input
                    type="text"
                    value={fac.city}
                    onChange={(e) => handleUpdate(fac.id, 'city', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      padding: '5px 8px',
                      fontSize: '12px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={fac.lat}
                    onChange={(e) => handleUpdate(fac.id, 'lat', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      padding: '5px 8px',
                      fontSize: '12px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={fac.lon}
                    onChange={(e) => handleUpdate(fac.id, 'lon', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#38bdf8',
                      fontFamily: 'monospace',
                      padding: '5px 8px',
                      fontSize: '12px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>📍 Quick GPS Preset</label>
                  <select
                    onChange={(e) => handleApplyPreset(fac.id, e.target.value)}
                    defaultValue=""
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      padding: '5px 8px',
                      fontSize: '11px',
                    }}
                  >
                    <option value="" disabled>Select Indian City...</option>
                    {PRESET_LOCATIONS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.lat.toFixed(2)}, {p.lon.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Notes / Context */}
              <div>
                <input
                  type="text"
                  value={fac.notes || ''}
                  onChange={(e) => handleUpdate(fac.id, 'notes', e.target.value)}
                  placeholder="Operational notes, consumption profiles, or hospital specialization..."
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontStyle: 'italic',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Total Facilities: <strong style={{ color: '#f8fafc' }}>{facilities.length}</strong> &bull; Changes will immediately update map markers, road calibration, and simulation invariants.
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '13px' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              style={{
                fontSize: '13px',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              }}
            >
              <Check size={16} /> Save &amp; Recalibrate Topology
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
