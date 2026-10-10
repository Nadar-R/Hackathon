import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_api_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["binding"] == "127.0.0.1"


def test_api_demo_dataset():
    response = client.get("/api/v1/demo")
    assert response.status_code == 200
    data = response.json()
    assert "dataset" in data
    assert "scenario" in data
    assert len(data["dataset"]["nodes"]) >= 5
    assert len(data["mitigations"]) >= 2


def test_api_simulate_end_to_end():
    demo_resp = client.get("/api/v1/demo")
    demo_data = demo_resp.json()

    sim_payload = {
        "dataset": demo_data["dataset"],
        "scenario": demo_data["scenario"],
        "mitigations": demo_data["mitigations"],
        "horizon_days": 10,
    }

    sim_resp = client.post("/api/v1/scenarios/simulate", json=sim_payload)
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert "kpis" in sim_data
    assert "daily_rows" in sim_data
    assert len(sim_data["daily_rows"]) > 0
    # Combined option ending stock is 3250
    assert sim_data["kpis"]["ending_stock"] == 3250


def test_api_compare_end_to_end():
    demo_resp = client.get("/api/v1/demo")
    demo_data = demo_resp.json()

    comp_payload = {
        "dataset": demo_data["dataset"],
        "scenario": demo_data["scenario"],
        "mitigations": demo_data["mitigations"],
        "horizon_days": 10,
    }

    comp_resp = client.post("/api/v1/scenarios/compare", json=comp_payload)
    assert comp_resp.status_code == 200
    comp_data = comp_resp.json()
    assert "rows" in comp_data
    assert len(comp_data["rows"]) == 5  # Base, Do Nothing, Opt1, Opt2, Combined
    labels = [r["label"] for r in comp_data["rows"]]
    assert "No Incident Baseline" in labels
    assert "Do Nothing (Unmitigated)" in labels


def test_api_export_csv():
    demo_resp = client.get("/api/v1/demo")
    demo_data = demo_resp.json()

    sim_payload = {
        "dataset": demo_data["dataset"],
        "scenario": demo_data["scenario"],
        "mitigations": [],
        "horizon_days": 10,
    }

    export_resp = client.post("/api/v1/export/csv", json=sim_payload)
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert "Day,Node ID,Product ID" in export_resp.text
