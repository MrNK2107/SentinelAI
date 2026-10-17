"""Tests for incident pattern mining and prevention priorities."""
from __future__ import annotations

import pytest
import numpy as np
from sentinel import config as C
from sentinel.sim.simulator import simulate_episode
from sentinel.incidents.records import build_incident_corpus
from sentinel.incidents.patterns import mine_patterns, prevention_priorities


def test_incident_corpus_and_mining():
    rng = np.random.default_rng(42)
    # Generate a small test batch of episodes
    import pandas as pd
    episodes = [
        simulate_episode("gas_leak_visible", rng, episode_id=1),
        simulate_episode("compound_hidden", rng, episode_id=2),
        simulate_episode("normal", rng, episode_id=3),
    ]

    records = build_incident_corpus(pd.concat(episodes, ignore_index=True))
    assert len(records) > 0
    assert any(r.outcome in ("INCIDENT", "NEAR_MISS") for r in records)

    mined = mine_patterns(records)
    assert "n_records" in mined
    assert "patterns" in mined
    assert mined["n_records"] == len(records)

    priorities = prevention_priorities(mined)
    assert isinstance(priorities, list)
    if priorities:
        assert "pattern" in priorities[0]
        assert "lift" in priorities[0]
        assert "actions" in priorities[0]
