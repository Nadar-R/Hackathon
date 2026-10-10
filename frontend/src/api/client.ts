import type {
  Dataset,
  IncidentScenario,
  MitigationOption,
  SimulationResult,
  ComparisonResult,
} from '../types';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

export async function fetchDemoData(): Promise<{
  dataset: Dataset;
  scenario: IncidentScenario;
  mitigations: MitigationOption[];
}> {
  const res = await fetch(`${API_BASE}/demo`);
  if (!res.ok) throw new Error(`Failed to fetch demo data: ${res.statusText}`);
  return res.json();
}

export async function runSimulation(
  dataset: Dataset,
  scenario: IncidentScenario,
  mitigations: MitigationOption[],
  horizonDays: number = 10
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/scenarios/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataset,
      scenario,
      mitigations,
      horizon_days: horizonDays,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.message || err.detail || 'Simulation failed');
  }
  return res.json();
}

export async function runComparison(
  dataset: Dataset,
  scenario: IncidentScenario,
  mitigations: MitigationOption[],
  horizonDays: number = 10
): Promise<ComparisonResult> {
  const res = await fetch(`${API_BASE}/scenarios/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataset,
      scenario,
      mitigations,
      horizon_days: horizonDays,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.message || err.detail || 'Comparison failed');
  }
  return res.json();
}

export async function exportCSV(
  dataset: Dataset,
  scenario: IncidentScenario,
  mitigations: MitigationOption[],
  horizonDays: number = 10
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataset,
      scenario,
      mitigations,
      horizon_days: horizonDays,
    }),
  });
  if (!res.ok) throw new Error('Failed to export CSV');
  return res.blob();
}

export async function runGoldenTests(): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
}> {
  const res = await fetch(`${API_BASE}/golden-tests`);
  if (!res.ok) throw new Error('Failed to run golden tests');
  return res.json();
}
