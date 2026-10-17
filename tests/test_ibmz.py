from fastapi.testclient import TestClient
from sentinel.api.app import app
from sentinel.ibmz.hardware import get_ibmz_hardware_info, ledger

client = TestClient(app)


def test_ibmz_hardware_endpoint():
    res = client.get("/api/v1/ibmz/hardware")
    assert res.status_code == 200
    data = res.json()
    assert "architecture" in data
    assert "byte_order" in data
    assert "has_nnpa" in data
    assert "has_cpacf" in data


def test_ibmz_ledger_endpoint():
    # Seal a test event
    entry = ledger.seal_event(
        event_type="TEST_AUDIT_SEAL",
        zone_id="ZONE_TEST",
        risk_score=0.85,
        interlock_status="REJECTED",
        details={"hazard": "LOWER_EXPLOSIVE_LIMIT_WARNING"},
    )
    assert "block_hash" in entry
    assert "signature" in entry

    res = client.get("/api/v1/ibmz/ledger")
    assert res.status_code == 200
    blocks = res.json()
    assert len(blocks) >= 1
    assert any(b["event_type"] == "TEST_AUDIT_SEAL" for b in blocks)
