"""Tests for the equipment-permit-hazard-regulation knowledge graph."""
from __future__ import annotations

import pytest
from sentinel.graph.knowledge_graph import GraphEdge, GraphNode, SafetyKnowledgeGraph
from sentinel.graph.builder import ZONE_TOPOLOGY, build_graph


def test_graph_node_and_edge_addition():
    g = SafetyKnowledgeGraph()
    g.add_node(GraphNode("Z1", "Zone", "Zone 1"))
    g.add_node(GraphNode("Z2", "Zone", "Zone 2"))
    g.add_edge("Z1", "Z2", "CONNECTED_TO", via="pipe")

    assert "Z1" in g.nodes
    assert "Z2" in g.nodes
    snap = g.to_dict()
    assert len(snap["nodes"]) == 2
    assert len(snap["edges"]) == 1
    assert snap["counts"]["Zone"] == 2


def test_shortest_path_explanation():
    g = SafetyKnowledgeGraph()
    g.add_node(GraphNode("A", "Zone", "A"))
    g.add_node(GraphNode("B", "Zone", "B"))
    g.add_node(GraphNode("C", "Zone", "C"))
    g.add_edge("A", "B", "CONNECTED_TO")
    g.add_edge("B", "C", "CONNECTED_TO")

    path = g.explain_path("A", "C")
    assert path is not None
    assert len(path) == 2
    assert "A" in path[0] and "B" in path[0]
    assert "B" in path[1] and "C" in path[1]
    assert g.explain_path("A", "NONEXISTENT") is None


def test_build_graph_from_zones():
    zone_states = [
        {
            "zone_id": "COB-A",
            "name": "Coke Oven Battery A",
            "risk": 0.35,
            "risk_band": "MEDIUM",
            "gas_lel": 4.5,
            "workers_in_zone": 5,
            "hot_work_active": False,
            "maintenance_active": False,
            "x": 18,
            "y": 24,
        },
        {
            "zone_id": "COB-B",
            "name": "Coke Oven Battery B",
            "risk": 0.85,
            "risk_band": "CRITICAL",
            "gas_lel": 18.2,
            "workers_in_zone": 7,
            "hot_work_active": True,
            "maintenance_active": True,
            "x": 38,
            "y": 24,
        },
        {
            "zone_id": "BYP-1",
            "name": "By-Product Plant",
            "risk": 0.40,
            "risk_band": "MEDIUM",
            "gas_lel": 3.0,
            "workers_in_zone": 4,
            "hot_work_active": False,
            "maintenance_active": False,
            "x": 62,
            "y": 20,
        },
    ]

    g = build_graph(zone_states)
    assert "PLANT" in g.nodes
    assert "COB-A" in g.nodes
    assert "COB-B" in g.nodes
    assert "BYP-1" in g.nodes

    # Check blast radius from COB-B
    radius = g.blast_radius("COB-B", max_hops=2)
    assert radius["origin"] == "COB-B"
    assert radius["origin_workers"] == 7
    # Connected zones should include COB-A and BYP-1
    connected_ids = {cz["zone_id"] for cz in radius["connected_zones"]}
    assert "COB-A" in connected_ids
    assert "BYP-1" in connected_ids
    # Total workers at risk across connected headers: 7 (origin) + 5 (COB-A) + 4 (BYP-1) = 16
    assert radius["total_workers_at_risk"] == 16


def test_permits_to_suspend():
    zone_states = [
        {
            "zone_id": "COB-B",
            "name": "Coke Oven Battery B",
            "risk": 0.9,
            "risk_band": "CRITICAL",
            "gas_lel": 22.0,
            "workers_in_zone": 6,
            "hot_work_active": True,
            "maintenance_active": False,
            "x": 38,
            "y": 24,
        },
        {
            "zone_id": "COB-A",
            "name": "Coke Oven Battery A",
            "risk": 0.2,
            "risk_band": "LOW",
            "gas_lel": 1.0,
            "workers_in_zone": 3,
            "hot_work_active": True,
            "maintenance_active": False,
            "x": 18,
            "y": 24,
        },
    ]

    g = build_graph(zone_states)
    suspensions = g.permits_to_suspend("COB-B", max_hops=1)
    assert len(suspensions) >= 1
    # Check that both the origin permit and connected zone hot-work permit are flagged
    permit_zones = {p["zone_id"] for p in suspensions}
    assert "COB-B" in permit_zones
    assert "COB-A" in permit_zones
