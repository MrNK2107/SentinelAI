"""Integration tests for unified API endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sentinel.api.app import app
from sentinel.api.service import plant


@pytest.fixture(scope="module")
def client():
    plant.startup()
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("ok", "degraded")
    assert "version" in data


def test_zones_endpoint(client):
    res = client.get("/api/v1/zones")
    assert res.status_code == 200
    zones = res.json()
    assert len(zones) >= 7
    # Verify both geo properties and risk properties are populated
    first = zones[0]
    assert "zone_id" in first
    assert "lat" in first
    assert "lon" in first
    assert "area_class" in first
    assert "risk" in first


def test_clock_and_geo(client):
    clock_res = client.get("/api/v1/clock")
    assert clock_res.status_code == 200
    assert "minute" in clock_res.json()

    geo_res = client.get("/api/v1/site/geo")
    assert geo_res.status_code == 200
    geo = geo_res.json()
    assert "boundary" in geo
    assert "osm_way_id" in geo


def test_knowledge_graph_endpoints(client):
    snap_res = client.get("/api/v1/graph")
    assert snap_res.status_code == 200
    snap = snap_res.json()
    assert "nodes" in snap
    assert "edges" in snap

    blast_res = client.get("/api/v1/graph/blast-radius/COB-B")
    assert blast_res.status_code == 200
    blast = blast_res.json()
    assert blast["origin"] == "COB-B"
    assert "connected_zones" in blast
    assert "total_workers_at_risk" in blast


def test_analytics_and_incidents_endpoints(client):
    kpis_res = client.get("/api/v1/analytics/kpis")
    assert kpis_res.status_code == 200
    assert "kpis" in kpis_res.json()

    pats_res = client.get("/api/v1/incidents/patterns")
    assert pats_res.status_code == 200
    pats = pats_res.json()
    assert "n_records" in pats
    assert "patterns" in pats
