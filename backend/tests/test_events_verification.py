import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_consignment_events_generation():
    demo = client.get("/api/v1/demo").json()
    payload = {
        "dataset": demo["dataset"],
        "scenario": demo["scenario"],
        "mitigations": demo["mitigations"],
        "horizon_days": 10,
    }
    res = client.post("/api/v1/scenarios/simulate", json=payload).json()
    assert "events" in res
    events = res["events"]
    assert len(events) > 0

    # Test that Day 1 has inbound consignment and outbound dispatch at Central Hub
    d1_events = [e for e in events if e["day"] == 1 and e["facility_id"] == "wh-mumbai-central"]
    inbounds = [e for e in d1_events if e["event_type"] == "inbound_consignment"]
    outbounds = [e for e in d1_events if e["event_type"] == "outbound_dispatch"]

    assert len(inbounds) >= 1
    assert len(outbounds) >= 1
    assert inbounds[0]["units_delta"] > 0
    assert outbounds[0]["units_delta"] < 0

    # Test quiescent events: facilities with 0 movements have exactly 1 event on that day
    apex_d1 = [e for e in events if e["day"] == 1 and e["facility_id"] == "hosp-apex-demand"]
    assert len(apex_d1) == 1
    assert apex_d1[0]["event_type"] == "quiescent"
