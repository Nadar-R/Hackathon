import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_custom_scenario_endpoint():
    res = client.get("/api/v1/custom-scenario")
    assert res.status_code == 200
    data = res.json()
    assert "dataset" in data
    assert len(data["dataset"]["nodes"]) == 6
    assert any(n["name"] == "Nhava Sheva Gateway (Port A)" for n in data["dataset"]["nodes"])
    assert any(n["name"] == "Hazira Container Terminal (Port B)" for n in data["dataset"]["nodes"])
    assert any(n["name"] == "Central Cloud & TOS Data Center" for n in data["dataset"]["nodes"])


def test_siem_telemetry_normal():
    res = client.get("/api/v1/siem/telemetry?attack_scenario=normal&count=10")
    assert res.status_code == 200
    data = res.json()
    assert data["is_attack_active"] is False
    assert len(data["telemetry_logs"]) == 10
    assert data["incident_summary"] is None


def test_siem_telemetry_ransomware():
    res = client.get("/api/v1/siem/telemetry?attack_scenario=ransomware&count=10")
    assert res.status_code == 200
    data = res.json()
    assert data["is_attack_active"] is True
    assert data["max_anomaly_score"] >= 0.65
    assert data["incident_summary"] is not None
    assert data["incident_summary"]["severity"] == "CRITICAL"
    assert "Ransomware" in data["incident_summary"]["attack_type"]


def test_daa_routes_primary_and_alternate():
    # When Port A is active: Primary path available
    res = client.get("/api/v1/daa/routes?port_a_active=true&port_b_active=true")
    assert res.status_code == 200
    data = res.json()
    assert data["primary_route"]["is_available"] is True
    assert "Port A" in data["primary_route"]["path_nodes"][0]

    # When Port A is knocked out by cyberattack
    res_disrupted = client.get("/api/v1/daa/routes?port_a_active=false&port_b_active=true")
    assert res_disrupted.status_code == 200
    data_disrupted = res_disrupted.json()
    assert data_disrupted["primary_route"]["is_available"] is False
    assert data_disrupted["alternate_route"]["is_available"] is True
    assert "Port B" in data_disrupted["alternate_route"]["path_nodes"][0]

    # Check loss matrix
    loss_matrix = data_disrupted["financial_loss_matrix"]
    assert loss_matrix["do_nothing"]["total_loss_usd"] == 1000000.0
    assert loss_matrix["mitigated_reroute"]["unmet_demand_cartons"] == 0
    assert loss_matrix["tradeoff_delta"]["net_financial_savings_usd"] > 800000.0
