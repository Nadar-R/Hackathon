import React from 'react';
import { CheckCircle2, TrendingUp, Navigation, AlertOctagon } from 'lucide-react';

interface LossMatrixData {
  algorithm: string;
  port_a_active: boolean;
  port_b_active: boolean;
  primary_route: {
    is_available: boolean;
    path_nodes: string[];
    distance_km: number;
    toll_cost: number;
    lead_time_days: number;
    status: string;
  };
  alternate_route: {
    is_available: boolean;
    path_nodes: string[];
    distance_km: number;
    toll_cost: number;
    lead_time_days: number;
    status: string;
  };
  financial_loss_matrix: {
    do_nothing: {
      unmet_demand_cartons: number;
      first_stockout_day: number;
      shortage_penalty_usd: number;
      facility_downtime_usd: number;
      total_loss_usd: number;
    };
    mitigated_reroute: {
      unmet_demand_cartons: number;
      first_stockout_day: number | null;
      rerouted_cartons: number;
      setup_cost_usd: number;
      freight_premium_usd: number;
      toll_expenses_usd: number;
      total_cost_usd: number;
    };
    tradeoff_delta: {
      net_financial_savings_usd: number;
      cartons_saved: number;
      patient_stockout_days_prevented: number;
      benefit_cost_ratio: number;
      verdict: string;
    };
  };
}

interface DaaLossMatrixCardProps {
  daaData: LossMatrixData | null;
  onTogglePortB: () => void;
  onOpenSiemModal: () => void;
}

export const DaaLossMatrixCard: React.FC<DaaLossMatrixCardProps> = ({
  daaData,
  onTogglePortB,
  onOpenSiemModal,
}) => {
  if (!daaData) return null;

  const { financial_loss_matrix: matrix, primary_route, alternate_route, port_a_active, port_b_active } = daaData;

  return (
    <div style={{
      background: 'rgba(13, 19, 32, 0.78)',
      border: '1px solid rgba(56, 189, 248, 0.2)',
      borderRadius: '14px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.5)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={18} color="#38bdf8" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Contingency Routing &amp; Total Impact Matrix
            </h3>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Algorithmic shortest and cost-optimal rerouting with comparative financial consequence of inaction vs mitigation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onOpenSiemModal}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Open SIEM Log Console
          </button>
          <button
            onClick={onTogglePortB}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              background: port_b_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${port_b_active ? '#10b981' : 'rgba(255, 255, 255, 0.15)'}`,
              color: port_b_active ? '#34d399' : '#94a3b8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {port_b_active ? '✓ Contingency Route Active' : '+ Activate Contingency Reroute'}
          </button>
        </div>
      </div>

      {/* Routes Quick Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
      }}>
        {/* Primary Route */}
        <div style={{
          background: 'rgba(11, 17, 30, 0.7)',
          border: `1px solid ${port_a_active ? 'rgba(56, 189, 248, 0.2)' : 'rgba(244, 63, 94, 0.3)'}`,
          borderRadius: '10px',
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
              Primary Supply Corridor
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: port_a_active ? 'rgba(56, 189, 248, 0.2)' : 'rgba(244, 63, 94, 0.2)',
              color: port_a_active ? '#38bdf8' : '#f43f5e',
            }}>
              {primary_route.status}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'flex', gap: '12px' }}>
            <span>Distance: <strong>{primary_route.distance_km} km</strong></span>
            <span>Transit: <strong>{primary_route.lead_time_days} day</strong></span>
            <span>Toll: <strong>${primary_route.toll_cost}</strong></span>
          </div>
        </div>

        {/* Alternate Route */}
        <div style={{
          background: 'rgba(11, 17, 30, 0.7)',
          border: `1px solid ${port_b_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(251, 191, 36, 0.2)'}`,
          borderRadius: '10px',
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
              Contingency Alternate Corridor
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: port_b_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 191, 36, 0.15)',
              color: port_b_active ? '#34d399' : '#fbbf24',
            }}>
              {alternate_route.status}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'flex', gap: '12px' }}>
            <span>Distance: <strong>{alternate_route.distance_km} km</strong></span>
            <span>Transit: <strong>{alternate_route.lead_time_days} days (+1d)</strong></span>
            <span>Toll: <strong>${alternate_route.toll_cost}</strong></span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Loss Comparison */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1.2fr',
        gap: '14px',
      }}>
        {/* Do Nothing Card */}
        <div style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fb7185', fontSize: '13px', fontWeight: 700 }}>
              <AlertOctagon size={16} /> Total Loss if Nothing Chosen
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f43f5e', marginTop: '8px' }}>
              ${matrix.do_nothing.total_loss_usd.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '10px', lineHeight: 1.5 }}>
              <div>&bull; Unmet ICU Demand: <strong>{matrix.do_nothing.unmet_demand_cartons.toLocaleString()} cartons</strong></div>
              <div>&bull; First Stockout Day: <strong>Day {matrix.do_nothing.first_stockout_day}</strong></div>
              <div>&bull; Shortage Penalty: ${matrix.do_nothing.shortage_penalty_usd.toLocaleString()}</div>
              <div>&bull; Terminal Idle Loss: ${matrix.do_nothing.facility_downtime_usd.toLocaleString()}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '12px' }}>
            Critical patient care severely compromised.
          </div>
        </div>

        {/* Mitigated Reroute Card */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '13px', fontWeight: 700 }}>
              <CheckCircle2 size={16} /> Alternate Reroute Cost
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', marginTop: '8px' }}>
              ${matrix.mitigated_reroute.total_cost_usd.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '10px', lineHeight: 1.5 }}>
              <div>&bull; Cartons Rerouted: <strong>{matrix.mitigated_reroute.rerouted_cartons.toLocaleString()} cartons</strong></div>
              <div>&bull; ICU Stockout: <strong>0 cartons (100% fulfilled)</strong></div>
              <div>&bull; Freight Premium: ${matrix.mitigated_reroute.freight_premium_usd.toLocaleString()}</div>
              <div>&bull; Route Tolls &amp; Setup: ${(matrix.mitigated_reroute.setup_cost_usd + matrix.mitigated_reroute.toll_expenses_usd).toLocaleString()}</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#86efac', marginTop: '12px' }}>
            Continuous hospital supply maintained.
          </div>
        </div>

        {/* Tradeoff ROI Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(99, 102, 241, 0.12))',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '13px', fontWeight: 700 }}>
              <TrendingUp size={16} /> Net Financial & Clinical ROI
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8', marginTop: '8px' }}>
              +${matrix.tradeoff_delta.net_financial_savings_usd.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '10px', lineHeight: 1.5 }}>
              <div>&bull; Avoided Losses: <strong>${matrix.tradeoff_delta.net_financial_savings_usd.toLocaleString()}</strong></div>
              <div>&bull; ICU Shortages Averted: <strong>{matrix.tradeoff_delta.cartons_saved.toLocaleString()} cartons</strong></div>
              <div>&bull; Benefit-Cost Ratio: <strong>{matrix.tradeoff_delta.benefit_cost_ratio}x Return</strong></div>
            </div>
          </div>
          <div style={{
            fontSize: '11px',
            color: '#cbd5e1',
            marginTop: '12px',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '8px',
            borderRadius: '6px',
            lineHeight: 1.4,
          }}>
            {matrix.tradeoff_delta.verdict}
          </div>
        </div>
      </div>
    </div>
  );
};
