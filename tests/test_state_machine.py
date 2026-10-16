"""The contract's state machine, driven through the fake GenVM.

Every test exercises a real branch: consensus agreement and disagreement, the
fail-closed paths, the discrete-status discipline, the fee accounting, the
attempt cap and its refund, and the pull-only treasury drain.
"""

import datetime
import json

import Beacon as beacon_module
import pytest
from beaconlib.canonicalize import policy_digest
from fake_genlayer import UserError

Address = beacon_module.Address

OWNER = "0x" + "aa" * 20
REQUESTER = "0x" + "bb" * 20
TREASURY = "0x" + "cc" * 20
OTHER = "0x" + "dd" * 20

T0 = 1_700_000_000
URL = "https://a.example.com/report"
FEE = 100
PATTERN = "*.example.com"


def set_time(gl, ts):
    dt = datetime.datetime.fromtimestamp(ts, datetime.UTC)
    gl.message.raw = {"datetime": dt.isoformat()}


def set_sender(gl, addr):
    gl.message.sender_address = Address(addr)


@pytest.fixture
def app(gl):
    set_time(gl, T0)
    set_sender(gl, OWNER)
    gl.message.value = 0
    return beacon_module.Beacon(TREASURY)


def create(app, gl, sponsor=OWNER, **over):
    set_sender(gl, sponsor)
    kwargs = {
        "policy_id": "main",
        "policy_text": "the service must publish a valid security.txt",
        "evidence_patterns": [PATTERN],
        "fee_amount": FEE,
    }
    kwargs.update(over)
    return app.create_policy(**kwargs)


def request(app, gl, requester=REQUESTER, policy_id="main", urls=None, value=FEE):
    set_sender(gl, requester)
    gl.message.value = value
    return app.request_evaluation(policy_id, urls or [URL])


def agree(nondet, status, sources=(0,)):
    answer = {"status": status, "supporting_sources": list(sources)}
    nondet.leader_answers = [json.dumps(answer)]


# --- policies --------------------------------------------------------------


def test_create_policy_and_view(app, gl):
    assert create(app, gl) == "main"
    policy = json.loads(app.get_policy("main"))
    assert policy["policy_id"] == "main"
    assert policy["sponsor"] == OWNER
    assert policy["evidence_patterns"] == [PATTERN]
    assert policy["fee_amount"] == str(FEE)
    assert policy["treasury"] == TREASURY
    assert len(policy["policy_hash"]) == 64


def test_policy_hash_binds_frozen_content(app, gl):
    create(app, gl)
    policy = json.loads(app.get_policy("main"))
    expected = policy_digest(
        "main", policy["policy_text"], [PATTERN], FEE, TREASURY
    )
    assert policy["policy_hash"] == expected


def test_create_rejects_duplicate(app, gl):
    create(app, gl)
    with pytest.raises(UserError):
        create(app, gl)


def test_create_rejects_bad_pattern(app, gl):
    with pytest.raises(UserError):
        create(app, gl, evidence_patterns=["not a host"])


def test_create_rejects_negative_fee(app, gl):
    with pytest.raises(UserError):
        create(app, gl, fee_amount=-1)


# --- requesting evaluations ------------------------------------------------


def test_request_freezes_urls_and_policy_hash(app, gl):
    create(app, gl)
    eid = request(app, gl)
    ev = json.loads(app.get_evaluation(eid))
    assert ev["status"] == "PENDING"
    assert ev["evidence_urls"] == [URL]
    assert ev["policy_hash"] == json.loads(app.get_policy("main"))["policy_hash"]
    assert ev["requester"] == REQUESTER
    assert ev["attempts"] == 0


def test_request_requires_exact_fee(app, gl):
    create(app, gl)
    with pytest.raises(UserError):
        request(app, gl, value=FEE + 1)
    with pytest.raises(UserError):
        request(app, gl, value=FEE - 1)


def test_request_zero_fee_policy(app, gl):
    create(app, gl, fee_amount=0)
    set_sender(gl, REQUESTER)
    gl.message.value = 0
    eid = app.request_evaluation("main", [URL])
    assert json.loads(app.get_evaluation(eid))["fee"] == "0"


def test_request_rejects_unknown_policy(app, gl):
    with pytest.raises(UserError):
        request(app, gl, policy_id="nope")


def test_request_rejects_disallowed_host(app, gl):
    create(app, gl)
    with pytest.raises(UserError):
        request(app, gl, urls=["https://evil.net/x"])


# --- evaluate: the converging paths ----------------------------------------


def test_evaluate_compliant_is_terminal_and_routes_fee(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "security.txt present and valid")
    agree(nondet, "COMPLIANT")
    set_sender(gl, REQUESTER)

    assert app.evaluate(eid) == "COMPLIANT"
    ev = json.loads(app.get_evaluation(eid))
    assert ev["status"] == "COMPLIANT"
    assert ev["attempts"] == 1
    assert ev["supporting_sources"] == [0]
    assert len(ev["fingerprints"]) == 1
    assert int(app.get_fee_claimable(TREASURY)) == FEE


def test_evaluate_non_compliant_is_terminal(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "security.txt missing")
    agree(nondet, "NON_COMPLIANT", sources=())
    set_sender(gl, REQUESTER)

    assert app.evaluate(eid) == "NON_COMPLIANT"
    assert json.loads(app.get_evaluation(eid))["status"] == "NON_COMPLIANT"
    assert int(app.get_fee_claimable(TREASURY)) == FEE


# --- evaluate: the fail-closed paths ---------------------------------------


def test_evaluate_unreadable_evidence_is_inconclusive(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    # No web entry: render raises inside both passes.
    agree(nondet, "COMPLIANT")
    set_sender(gl, REQUESTER)

    assert app.evaluate(eid) == "INCONCLUSIVE"
    ev = json.loads(app.get_evaluation(eid))
    assert ev["status"] == "PENDING"  # retryable
    assert ev["last_status"] == "INCONCLUSIVE"
    assert ev["code"] == "unreadable_evidence"
    assert nondet.prompts == []  # the model is never consulted
    assert int(app.get_fee_claimable(TREASURY)) == 0


def test_evaluate_conflicting_fingerprints_is_inconclusive(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    # Leader and validator fetch different bytes for the same URL.
    nondet.web[URL] = [(200, "compliant text"), (200, "different text")]
    agree(nondet, "COMPLIANT")
    set_sender(gl, REQUESTER)

    assert app.evaluate(eid) == "INCONCLUSIVE"
    ev = json.loads(app.get_evaluation(eid))
    assert ev["last_status"] == "INCONCLUSIVE"
    assert ev["code"] == "no_consensus"
    assert int(app.get_fee_claimable(TREASURY)) == 0


def test_evaluate_consensus_exception_fails_closed(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "ok")
    agree(nondet, "COMPLIANT")
    nondet.force_exception = True
    set_sender(gl, REQUESTER)

    assert app.evaluate(eid) == "INCONCLUSIVE"
    assert json.loads(app.get_evaluation(eid))["code"] == "no_consensus"


def test_compliant_without_sources_is_downgraded(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "ok")
    nondet.leader_answers = [json.dumps({"status": "COMPLIANT"})]
    set_sender(gl, REQUESTER)

    assert app.evaluate(eid) == "INCONCLUSIVE"
    assert json.loads(app.get_evaluation(eid))["code"] == "no_supporting_sources"


# --- evaluate: discipline --------------------------------------------------


def test_double_evaluation_refused(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "ok")
    agree(nondet, "NON_COMPLIANT", sources=())
    set_sender(gl, REQUESTER)
    app.evaluate(eid)
    with pytest.raises(UserError):
        app.evaluate(eid)


def test_evaluate_refused_after_attempt_cap(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    set_sender(gl, REQUESTER)
    for _ in range(beacon_module.MAX_ATTEMPTS):
        assert app.evaluate(eid) == "INCONCLUSIVE"
    assert json.loads(app.get_evaluation(eid))["attempts"] == beacon_module.MAX_ATTEMPTS
    with pytest.raises(UserError):
        app.evaluate(eid)


def test_stranger_can_evaluate(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "ok")
    agree(nondet, "NON_COMPLIANT", sources=())
    set_sender(gl, OTHER)
    assert app.evaluate(eid) == "NON_COMPLIANT"


# --- cancel_stale ----------------------------------------------------------


def test_cancel_refused_while_fresh(app, gl):
    create(app, gl)
    eid = request(app, gl)
    with pytest.raises(UserError):
        app.cancel_stale(eid)


def test_cancel_refunds_after_attempts(app, gl, nondet, chain):
    create(app, gl)
    eid = request(app, gl)
    set_sender(gl, REQUESTER)
    for _ in range(beacon_module.MAX_ATTEMPTS):
        app.evaluate(eid)
    # Anyone may advance the refund; only the requester receives it.
    set_sender(gl, OTHER)
    assert app.cancel_stale(eid) == "CANCELLED"
    assert json.loads(app.get_evaluation(eid))["status"] == "CANCELLED"
    assert chain.sent == [(REQUESTER, FEE)]


def test_cancel_refunds_after_timeout(app, gl, chain):
    create(app, gl)
    eid = request(app, gl)
    with pytest.raises(UserError):
        app.cancel_stale(eid)
    set_time(gl, T0 + beacon_module.STALE_TIMEOUT_SECONDS + 1)
    assert app.cancel_stale(eid) == "CANCELLED"
    assert chain.sent == [(REQUESTER, FEE)]


def test_cancel_refuses_terminal_evaluation(app, gl, nondet):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "ok")
    agree(nondet, "NON_COMPLIANT", sources=())
    set_sender(gl, REQUESTER)
    app.evaluate(eid)
    set_time(gl, T0 + beacon_module.STALE_TIMEOUT_SECONDS + 1)
    with pytest.raises(UserError):
        app.cancel_stale(eid)


# --- fees ------------------------------------------------------------------


def test_claim_fees_is_treasury_only_and_once(app, gl, nondet, chain):
    create(app, gl)
    eid = request(app, gl)
    nondet.web[URL] = (200, "ok")
    agree(nondet, "COMPLIANT")
    set_sender(gl, REQUESTER)
    app.evaluate(eid)

    set_sender(gl, OTHER)
    with pytest.raises(UserError):
        app.claim_fees()

    set_sender(gl, TREASURY)
    assert app.claim_fees() == str(FEE)
    assert chain.sent == [(TREASURY, FEE)]
    with pytest.raises(UserError):
        app.claim_fees()


def test_zero_fee_evaluation_owes_nothing(app, gl, nondet):
    create(app, gl, fee_amount=0)
    set_sender(gl, REQUESTER)
    gl.message.value = 0
    eid = app.request_evaluation("main", [URL])
    nondet.web[URL] = (200, "ok")
    agree(nondet, "NON_COMPLIANT", sources=())
    set_sender(gl, REQUESTER)
    app.evaluate(eid)
    assert int(app.get_fee_claimable(TREASURY)) == 0


# --- board, config, and surface discipline ---------------------------------


def test_board_and_policy_index(app, gl):
    create(app, gl)
    assert json.loads(app.get_policy_ids()) == ["main"]
    assert json.loads(app.get_policy("main"))["policy_id"] == "main"
    eid = request(app, gl)
    board = json.loads(app.get_board(10))
    assert board and board[0]["evaluation_id"] == eid
    assert board[0]["status"] == "PENDING"


def test_config_shape(app, gl):
    create(app, gl)
    cfg = json.loads(app.get_config())
    for key in (
        "owner",
        "treasury",
        "max_attempts",
        "stale_timeout_seconds",
        "max_evidence_urls",
        "next_policy",
        "next_evaluation",
    ):
        assert key in cfg


@pytest.mark.parametrize("forbidden", ["claim", "appeal", "settle", "dispute", "payout", "refund"])
def test_no_dispute_or_payout_surface(beacon, forbidden):
    assert not hasattr(beacon.Beacon, forbidden)
