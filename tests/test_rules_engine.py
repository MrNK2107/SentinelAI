"""Interlock tests.

These cover the safety contract: the deterministic layer decides, and the model
may only ever make an outcome stricter. If any of these fail, the guarantee the
whole system is sold on no longer holds.
"""
from __future__ import annotations

import pytest

from sentinel.rules.engine import (
    CONFINED_SPACE_MAX_LEL,
    GENERAL_MAX_LEL,
    HOT_WORK_MAX_LEL,
    O2_MAX_PCT,
    O2_MIN_PCT,
    PermitRequest,
    ZoneConditions,
    evaluate_interlocks,
    evaluate_permit,
)

STRICTNESS = {"APPROVED": 0, "CONDITIONAL": 1, "REJECTED": 2}


def decide(permit_type="Hot Work", *, risk=None, **cond):
    return evaluate_permit(
        PermitRequest(permit_type, zone="COB-B"),
        ZoneConditions(**cond),
        compound_risk=risk,
    )


# ----------------------------------------------------------------- interlocks
def test_hot_work_rejected_at_gas_limit():
    assert decide(gas_lel=HOT_WORK_MAX_LEL).status == "REJECTED"


def test_hot_work_allowed_below_limit_in_calm_conditions():
    assert decide(gas_lel=HOT_WORK_MAX_LEL - 2.0).status == "APPROVED"


def test_confined_space_rejected_on_oxygen_deficiency():
    assert decide("Confined Space", gas_lel=0.0, o2_pct=O2_MIN_PCT - 0.1).status == "REJECTED"


def test_confined_space_rejected_on_oxygen_enrichment():
    """Enrichment is as disqualifying as deficiency -- it raises fire risk."""
    assert decide("Confined Space", gas_lel=0.0, o2_pct=O2_MAX_PCT + 0.1).status == "REJECTED"


def test_confined_space_rejected_at_gas_limit():
    assert decide("Confined Space", gas_lel=CONFINED_SPACE_MAX_LEL).status == "REJECTED"


def test_general_work_rejected_at_general_limit():
    assert decide("Cold Work", gas_lel=GENERAL_MAX_LEL).status == "REJECTED"


def test_cold_work_tolerates_gas_that_bars_hot_work():
    """No ignition source, so the hot-work limit must not apply to cold work."""
    assert decide("Cold Work", gas_lel=HOT_WORK_MAX_LEL + 1.0).status != "REJECTED"


# ------------------------------------------------------------ safety contract
@pytest.mark.parametrize("risk", [0.0, 0.25, 0.5, 0.75, 0.9, 1.0])
@pytest.mark.parametrize("gas", [0.0, 2.0, 4.0, 6.0, 12.0, 40.0])
def test_model_can_only_tighten_never_loosen(risk, gas):
    """The model must never move a decision toward permissive.

    This is the load-bearing property: sweep the model output across its whole
    range at each gas level and assert the verdict is never weaker than the
    deterministic one.
    """
    deterministic = decide(gas_lel=gas)
    with_model = decide(gas_lel=gas, risk=risk)
    assert STRICTNESS[with_model.status] >= STRICTNESS[deterministic.status]


def test_high_risk_cannot_rescue_a_rejected_permit():
    """Even a zero-risk model output cannot clear a hard gas rejection."""
    assert decide(gas_lel=HOT_WORK_MAX_LEL + 10, risk=0.0).status == "REJECTED"


def test_high_model_risk_escalates_an_otherwise_approved_permit():
    calm = dict(gas_lel=0.5)
    assert decide(**calm).status == "APPROVED"
    assert decide(**calm, risk=0.95).status == "REJECTED"


def test_moderate_model_risk_downgrades_to_conditional():
    assert decide(gas_lel=0.5, risk=0.6).status == "CONDITIONAL"


# ------------------------------------------------------- standing interlocks
def test_active_hot_work_above_limit_triggers_suspension():
    out = evaluate_interlocks(ZoneConditions(gas_lel=HOT_WORK_MAX_LEL + 1), hot_work_active=True)
    assert out and any("SUSPEND" in s.upper() for s in out)


def test_workers_present_above_general_limit_triggers_evacuation():
    out = evaluate_interlocks(
        ZoneConditions(gas_lel=GENERAL_MAX_LEL + 1, workers_in_zone=4), hot_work_active=False
    )
    assert out and any("EVACUAT" in s.upper() for s in out)


def test_calm_zone_raises_no_standing_interlocks():
    assert evaluate_interlocks(ZoneConditions(gas_lel=0.5, workers_in_zone=2), False) == []


# ------------------------------------------------------------------- outputs
def test_every_decision_carries_a_reason():
    for permit in ("Hot Work", "Confined Space", "Cold Work", "Electrical"):
        for gas in (0.0, 6.0, 20.0):
            d = decide(permit, gas_lel=gas)
            assert d.reasons, f"{permit} @ {gas} %LEL produced no reason"
