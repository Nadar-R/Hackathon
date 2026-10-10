# CyberSupply

**Real-Time Supply Chain Resiliency & Cyber Impact Simulator**

CyberSupply is a mission-critical simulation platform engineered to quantify cascading impacts of cyber disruptions on multi-echelon physical supply networks. It bridges the gap between IT/OT cybersecurity telemetry (SIEM) and supply chain operations, featuring dynamic multi-criteria highway routing, inventory depletion projections, and financial impact mitigation matrices.

---

## Key Features

- **Interactive GIS Network & Facility Editor**:
  - Live Leaflet map visualizing critical nodes (Gateway Ports, Regional Depots, Hospitals, and Cloud/TOS Data Centers).
  - Highway-following routes powered by local OSRM road routing with fallback geodesic interpolation.
  - Interactive facility creator & coordinate editor.
- **Embedded SIEM Threat Intelligence**:
  - Real-time event log ingestion and anomaly scoring powered by scikit-learn IsolationForest.
  - Interactive search, category filters (`PROCESS`, `DATABASE`, `NETWORK`, `AUTH`, `API_GATEWAY`), and "Anomalies Only" isolation.
  - Telemetry drill-down drawer inspecting CPU, request volume, failed authentications, disk IOPS, and latency.
- **Multi-Criteria Highway Routing Engine**:
  - NetworkX Dijkstra pathfinding evaluating composite impedance across distance, highway tolls, and transit delay.
  - Multi-echelon last-mile distribution routing from warehouses to clinical destinations.
  - Automated contingency bypass calculating freight premiums, route setup fees, and ICU stockout prevention.
- **Deterministic Core & Golden Test Verification**:
  - End-to-end deterministic simulation model covering 12 golden validation cases (G1–G12).
  - Ledger-level stock tracking, in-transit consignment pipelines, and penalty modeling.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Leaflet, Lucide Icons, Vanilla CSS Design System.
- **Backend**: FastAPI, Python 3.14, NetworkX, Scikit-Learn, Pytest.

---

## Quickstart Guide

### 1. Backend Setup
```bash
# From workspace root
python -m pip install -r backend/requirements.txt  # or run directly with installed dependencies
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Run test suite:
```bash
python -m pytest backend/tests/ -v
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints.py      # REST endpoints (simulation, SIEM, routing)
│   │   ├── core/                    # Domain models, ledger, simulator engine
│   │   ├── services/                # SIEM telemetry & multi-criteria routing
│   │   └── data/                    # Network topologies & custom scenarios
│   └── tests/                       # 22 automated test suites (API, graph, G1-G12)
├── frontend/
│   ├── src/
│   │   ├── components/              # Leaflet GIS Map, SIEM modal, Loss Matrix, etc.
│   │   ├── api/                     # Typed client API integration
│   │   └── App.tsx                  # Main CyberSupply workspace dashboard
│   └── index.html
└── .gitignore
```
