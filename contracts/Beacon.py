# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""BEACON -- a frozen-policy status oracle.

A sponsor freezes a natural-language policy, the evidence hosts it may be judged
against, and an optional evaluation fee. Any agent then requests an evaluation,
which freezes the exact evidence URLs for that request. Under the Equivalence
Principle, validators independently re-fetch those URLs, apply the same
deterministic normalization and length rules, fingerprint the full content of every
document, and re-derive one discrete status:

    COMPLIANT | NON_COMPLIANT | INCONCLUSIVE

There are no other outcomes, and no money moves as a result of a status. The
agreed status is stored as an append-only record carrying the timestamps,
the full-content fingerprints, and the policy hash it was judged under.
Downstream agents read it; there is no appeal, no dispute, and no settlement.

The only value that ever moves is an optional small evaluation fee, held while
an evaluation is pending and routed to the recorded treasury once a COMPLIANT or
NON_COMPLIANT status converges. If an evaluation never converges past the
attempt cap, a permissionless cancel refunds the fee to the requester in full.

State is JSON documents in TreeMaps rather than nested storage dataclasses:
evaluations are read and written whole, so a single document is the natural unit
and a flat storage surface is easier to audit than a graph of one.
"""

import datetime
import json

import genlayer as gl

# isort: off
# These two MUST stay above the beaconlib marker below. The bundler replaces
# everything between the markers with inlined beaconlib source, so an SDK
# import that drifts inside the block is silently deleted from the deployable
# while every local test keeps passing against the fake runtime.
from genlayer.storage import TreeMap
from genlayer.types import *
# isort: on

# --- beaconlib (inlined by contracts/build_bundle.py for deployment) -------
from beaconlib.canonicalize import (
    normalize_policy_id,
    normalize_policy_text,
    policy_digest,
)
from beaconlib.judgment import (
    COMPLIANT,
    INCONCLUSIVE,
    NON_COMPLIANT,
    build_comparable,
    build_prompt,
    comparable_json,
    normalize_evidence,
)
from beaconlib.ssrf import (
    MAX_EVIDENCE_URLS,
    BeaconError,
    normalize_evidence_urls,
    normalize_patterns,
)

# --- end beaconlib ---------------------------------------------------------

ST_PENDING = "PENDING"
ST_CANCELLED = "CANCELLED"

# Bounded number of evaluation rounds a single request may consume before a
# permissionless cancel becomes available. Each round is one full consensus
# pass; if none of them converges on COMPLIANT or NON_COMPLIANT, the request is
# treated as permanently inconclusive rather than retried forever.
MAX_ATTEMPTS = 5

# Independent, time-based escape hatch for the same stall: if no one calls
# evaluate at all, the fee must not sit in the contract indefinitely.
STALE_TIMEOUT_SECONDS = 86400  # 24h
MAX_BOARD = 50


@gl.evm.contract_interface
class _Recipient:
    """Nameless-transfer interface used to pay native GEN out to a wallet."""

    class View:
        pass

    class Write:
        pass


def _err(reason):
    """Raise a stable, lowercase, machine-comparable user error."""
    raise gl.vm.UserError(reason)


def _safe_json(raw):
    """Parse model output without ever letting a parse failure become a decision."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    if not isinstance(raw, str):
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        start, end = raw.find("{"), raw.rfind("}")
        if start == -1 or end <= start:
            return {}
        try:
            parsed = json.loads(raw[start:end + 1])
        except Exception:
            return {}
    return parsed if isinstance(parsed, dict) else {}


def _parse_agreed(agreed, fallback):
    """Read what the validators agreed on, failing closed on anything else."""
    if not isinstance(agreed, str) or not agreed.strip():
        return dict(fallback)
    try:
        parsed = json.loads(agreed)
    except Exception:
        return dict(fallback)
    return parsed if isinstance(parsed, dict) else dict(fallback)


def _to_account_str(value):
    """Coerce an address-shaped argument into the lowercase hex string stored here.

    Tooling can hand a 40-hex address to a `str`-annotated parameter already
    decoded as an `Address`; accepting both means an address-typed caller is
    never locked out by an encoding detail while local tests pass.
    """
    if isinstance(value, Address):
        return value.as_hex.lower()
    if isinstance(value, str):
        return value.strip().lower()
    return ""


def _to_address(value):
    """Coerce a constructor argument into an Address, or None if unset."""
    if value is None or value == "":
        return None
    if isinstance(value, Address):
        return value
    return Address(value)


def _guard(fn):
    """Run pure-lib code, translating its BeaconError into a GenVM user error."""
    try:
        return fn()
    except BeaconError as e:
        _err(str(e))


# The fail-closed comparable. A round that never reaches agreement stores this
# status: INCONCLUSIVE, no sources, a code that says why. It is built by hand
# (rather than through build_comparable) because a failed round has no evidence
# fingerprints available outside the judgment closure, and inventing any would
# be a lie about what was fetched.
_FAIL_CLOSED = {
    "status": INCONCLUSIVE,
    "supporting_sources": [],
    "clause_ids": [],
    "fingerprints": [],
    "code": "no_consensus",
}


class Beacon(gl.contract.Contract):
    # --- storage ----------------------------------------------------------
    owner: Address
    treasury: Address
    next_policy: u256
    next_evaluation: u256

    policies: TreeMap[str, str]        # policy id -> policy JSON
    policy_ids: TreeMap[str, str]      # "all" -> JSON list of policy ids
    evaluations: TreeMap[str, str]     # evaluation id -> evaluation JSON
    board: TreeMap[str, str]           # "all" -> JSON list of evaluation ids
    claimable: TreeMap[str, u256]      # address (lowercase hex) -> wei owed

    def __init__(self, treasury: str = ""):
        self.owner = gl.message.sender_address
        self.treasury = _to_address(treasury) or gl.message.sender_address
        self.next_policy = u256(1)
        self.next_evaluation = u256(1)

    # ------------------------------------------------------------------
    # internals
    # ------------------------------------------------------------------

    def _now(self) -> int:
        """Current time in whole seconds.

        Read from the message itself (`gl.message.raw["datetime"]`), which every
        validator re-executing this call sees identically. `gl.block` does not
        exist and `gl.vm.get_timestamp()` raises on this runtime; the message
        field is the one that works and the right source on the merits.
        """
        try:
            raw = gl.message.raw["datetime"]
        except Exception:
            raw = gl.message.datetime
        raw = str(raw).strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        return int(datetime.datetime.fromisoformat(raw).timestamp())

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex.lower()

    def _load_policy(self, policy_id):
        blob = self.policies.get(str(policy_id).strip().lower())
        return json.loads(blob) if blob is not None else None

    def _load_evaluation(self, evaluation_id):
        blob = self.evaluations.get(str(evaluation_id).strip())
        return json.loads(blob) if blob is not None else None

    def _store_policy(self, policy: dict) -> None:
        self.policies[policy["policy_id"]] = json.dumps(policy, sort_keys=True)

    def _store_evaluation(self, evaluation: dict) -> None:
        self.evaluations[evaluation["evaluation_id"]] = json.dumps(
            evaluation, sort_keys=True
        )

    def _credit(self, addr: str, amount: int) -> None:
        """Owe wei to an address. Never pushes fees -- claim_fees() pulls."""
        if int(amount) <= 0:
            return
        key = str(addr).lower()
        self.claimable[key] = u256(int(self.claimable.get(key, 0)) + int(amount))

    def _append_policy_id(self, policy_id: str) -> None:
        raw = self.policy_ids.get("all")
        items = json.loads(raw) if raw else []
        if policy_id not in items:
            items.append(policy_id)
        self.policy_ids["all"] = json.dumps(items)

    def _append_board(self, evaluation_id: str) -> None:
        raw = self.board.get("all")
        items = json.loads(raw) if raw else []
        if evaluation_id not in items:
            items.append(evaluation_id)
        if len(items) > MAX_BOARD:
            items = items[-MAX_BOARD:]
        self.board["all"] = json.dumps(items)

    def _fresh_evaluation_id(self) -> str:
        n = int(self.next_evaluation)
        self.next_evaluation = u256(n + 1)
        return f"e{n}"

    # ------------------------------------------------------------------
    # writes: policies
    # ------------------------------------------------------------------

    @gl.public.write
    def create_policy(
        self,
        policy_id: str,
        policy_text: str,
        evidence_patterns: list,
        fee_amount: int,
    ) -> str:
        """Register an immutable policy. The sender becomes its sponsor.

        `evidence_patterns` is the allow-list of hosts an evaluation of this
        policy may fetch from. `fee_amount` is an optional evaluation fee in wei
        -- zero is allowed -- routed to the treasury when an evaluation
        converges and refunded in full if one never does.
        """
        handle = _guard(lambda: normalize_policy_id(policy_id))
        if self.policies.get(handle) is not None:
            _err("policy id already registered")

        text = _guard(lambda: normalize_policy_text(policy_text))
        pats = _guard(lambda: normalize_patterns(evidence_patterns))
        fee = int(fee_amount)
        if fee < 0:
            _err("fee must not be negative")

        treasury_hex = self.treasury.as_hex.lower()
        phash = policy_digest(handle, text, pats, fee, treasury_hex)
        policy = {
            "policy_id": handle,
            "sponsor": self._sender(),
            "policy_text": text,
            "evidence_patterns": pats,
            # Wei is stored as a decimal string: 0.01 GEN is 1e16 wei, above
            # JavaScript's 2**53 exact-integer range, so a JSON number here
            # would silently lose precision on the way to any JS client.
            "fee_amount": str(fee),
            "treasury": treasury_hex,
            "policy_hash": phash,
            "created_at": self._now(),
        }
        self._store_policy(policy)
        self._append_policy_id(handle)
        return handle

    # ------------------------------------------------------------------
    # writes: evaluations
    # ------------------------------------------------------------------

    @gl.public.write.payable
    def request_evaluation(self, policy_id: str, evidence_urls: list) -> str:
        """Freeze the exact evidence URLs for one evaluation of a policy.

        The attached value must equal the policy's fee exactly, so no value is
        ever stranded by an overpayment and the contract only ever holds what a
        single evaluation disclosed. The evidence URLs are frozen here and are
        what every validator will independently re-fetch.
        """
        policy = self._load_policy(policy_id)
        if policy is None:
            _err("policy not found")

        urls = _guard(
            lambda: normalize_evidence_urls(evidence_urls, policy["evidence_patterns"])
        )

        fee = int(policy["fee_amount"])
        value = int(gl.message.value)
        if value != fee:
            _err("attached value must equal the policy fee")

        eid = self._fresh_evaluation_id()
        evaluation = {
            "evaluation_id": eid,
            "policy_id": policy["policy_id"],
            "policy_hash": policy["policy_hash"],
            "evidence_urls": urls,
            "requester": self._sender(),
            "fee": str(fee),
            "status": ST_PENDING,
            "last_status": "",
            "code": "",
            "supporting_sources": [],
            "clause_ids": [],
            "fingerprints": [],
            "attempts": 0,
            "created_at": self._now(),
            "evaluated_at": 0,
            "cancelled_at": 0,
        }
        self._store_evaluation(evaluation)
        self._append_board(eid)
        return eid

    @gl.public.write
    def evaluate(self, evaluation_id: str) -> str:
        """Run one consensus judgment round for an evaluation.

        Permissionless -- the requester has a direct incentive to call it, but
        anyone may, so an evaluation cannot be left to rot by whoever opened it.
        A round that converges on COMPLIANT or NON_COMPLIANT is terminal and
        routes the fee to the treasury. A round that lands on INCONCLUSIVE
        records the attempt and stays PENDING, retryable up to MAX_ATTEMPTS.
        """
        evaluation = self._load_evaluation(evaluation_id)
        if evaluation is None:
            _err("evaluation not found")
        if evaluation["status"] != ST_PENDING:
            _err("evaluation is not pending")

        attempts = int(evaluation["attempts"])
        if attempts >= MAX_ATTEMPTS:
            _err("attempt cap reached; cancel_stale refunds the fee")

        policy = self._load_policy(evaluation["policy_id"])
        if policy is None:
            _err("policy not found")

        # ---------------------------------------------------------------
        # Non-deterministic section. Exactly ONE top-level nondet call
        # (gl.eq_principle.strict_eq) lives in this method -- every
        # gl.nondet.web.get / gl.nondet.exec_prompt call happens inside
        # `judge`, which the equivalence principle runs once on the leader and
        # again, completely independently, on every validator. The closure
        # touches no self.* storage; it closes only over locals copied above.
        # ---------------------------------------------------------------
        result = self._judge(policy["policy_text"], evaluation["evidence_urls"])
        status = str(result.get("status", INCONCLUSIVE))

        evaluation["attempts"] = attempts + 1
        evaluation["last_status"] = status
        evaluation["code"] = str(result.get("code", ""))
        evaluation["supporting_sources"] = list(result.get("supporting_sources", []))
        evaluation["clause_ids"] = list(result.get("clause_ids", []))
        evaluation["fingerprints"] = list(result.get("fingerprints", []))
        evaluation["evaluated_at"] = self._now()

        if status in (COMPLIANT, NON_COMPLIANT):
            evaluation["status"] = status
            self._credit(self.treasury.as_hex, int(evaluation["fee"]))
        else:
            # Not converged: the attempt is recorded, the request stays open so
            # another round may be attempted, and the fee is still held.
            evaluation["status"] = ST_PENDING

        self._store_evaluation(evaluation)
        return status

    @gl.public.write
    def cancel_stale(self, evaluation_id: str) -> str:
        """Refund a fee for an evaluation that never converged.

        Permissionless: callable by anyone once a still-PENDING evaluation has
        either burned the attempt cap or sat untouched past the stale timeout.
        The refund is sent only to the evaluation's recorded requester, so an
        unrelated caller can advance the refund but can never redirect it.
        """
        evaluation = self._load_evaluation(evaluation_id)
        if evaluation is None:
            _err("evaluation not found")
        if evaluation["status"] != ST_PENDING:
            _err("evaluation is not pending")

        attempts = int(evaluation["attempts"])
        expired = self._now() >= int(evaluation["created_at"]) + STALE_TIMEOUT_SECONDS
        if attempts < MAX_ATTEMPTS and not expired:
            _err("evaluation has neither used the attempts nor reached the timeout")

        evaluation["status"] = ST_CANCELLED
        evaluation["cancelled_at"] = self._now()
        self._store_evaluation(evaluation)

        fee = int(evaluation["fee"])
        if fee > 0:
            _Recipient(Address(evaluation["requester"])).emit_transfer(value=u256(fee))
        return ST_CANCELLED

    # ------------------------------------------------------------------
    # writes: fees
    # ------------------------------------------------------------------

    @gl.public.write
    def claim_fees(self) -> str:
        """Withdraw accumulated evaluation fees to the treasury.

        Pull-only, treasury-only, and zeroed before the transfer, so nothing is
        ever pushed to an address that cannot receive it and no balance is
        double-spent. This is the only function that moves fees out.
        """
        sender = self._sender()
        if sender != self.treasury.as_hex.lower():
            _err("only the treasury may claim fees")
        amount = int(self.claimable.get(sender, 0))
        if amount <= 0:
            _err("nothing to claim")
        self.claimable[sender] = u256(0)
        _Recipient(gl.message.sender_address).emit_transfer(value=u256(amount))
        return str(amount)

    # ------------------------------------------------------------------
    # the one non-deterministic path
    # ------------------------------------------------------------------

    def _judge(self, policy_text, urls) -> dict:
        """Run the compliance judgment under validator consensus.

        One `strict_eq` block, and it is the only non-deterministic call an
        evaluation makes. Every validator runs `judge` itself, fetching the
        evidence independently, and each canonicalizes its result through the
        same pure function, so agreement is decided on the discrete status, the
        sorted source/clause sets, and the full-content fingerprints -- never on
        prose.
        """

        def judge() -> str:
            # Inlined rather than factored: genvm-lint only follows
            # gl.nondet.* calls made directly inside the function handed to the
            # equivalence principle, and rejects the contract when they sit one
            # closure hop away.
            evidence = []
            all_ok = True
            for u in urls:
                try:
                    # Fetch the response object, not rendered text: the status
                    # must be read explicitly. A 404/500 page can carry prose
                    # that looks like evidence, so treating every successful
                    # fetch as HTTP 200 would let an error page decide a
                    # status. `get` returns `status` and `body` (bytes on this
                    # SDK); a non-200 response is marked unreadable, which
                    # short-circuits to INCONCLUSIVE below.
                    page = gl.nondet.web.get(u)
                    ev = normalize_evidence(
                        u,
                        getattr(page, "status", 0),
                        getattr(page, "body", b""),
                    )
                except Exception:
                    ev = normalize_evidence(u, 0, b"")
                if not ev["ok"]:
                    all_ok = False
                evidence.append(ev)

            # An unreadable or partially-read evidence set can only ever be
            # INCONCLUSIVE. The model is not consulted at all in that case, so
            # a fetch failure is structurally incapable of producing a
            # COMPLIANT or NON_COMPLIANT status.
            if not all_ok:
                return comparable_json(
                    build_comparable({"status": INCONCLUSIVE}, evidence)
                )

            prompt = build_prompt(policy_text, evidence)
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            return comparable_json(build_comparable(_safe_json(raw), evidence))

        try:
            agreed = gl.eq_principle.strict_eq(judge)
            return _parse_agreed(agreed, _FAIL_CLOSED)
        except Exception:
            # No consensus. Two validators fetched different bytes (their
            # fingerprints disagree) or the round could not run at all: a
            # technical failure, not a finding. Fail closed to INCONCLUSIVE and
            # never assert compliance.
            return dict(_FAIL_CLOSED)

    # ------------------------------------------------------------------
    # views
    # ------------------------------------------------------------------

    @gl.public.view
    def get_config(self) -> str:
        return json.dumps(
            {
                "owner": self.owner.as_hex,
                "treasury": self.treasury.as_hex,
                "max_attempts": MAX_ATTEMPTS,
                "stale_timeout_seconds": STALE_TIMEOUT_SECONDS,
                "max_evidence_urls": MAX_EVIDENCE_URLS,
                "next_policy": int(self.next_policy),
                "next_evaluation": int(self.next_evaluation),
            },
            sort_keys=True,
        )

    @gl.public.view
    def get_policy(self, policy_id: str) -> str:
        return self.policies.get(str(policy_id).strip().lower(), "")

    @gl.public.view
    def get_policy_ids(self) -> str:
        return self.policy_ids.get("all", "[]")

    @gl.public.view
    def get_evaluation(self, evaluation_id: str) -> str:
        return self.evaluations.get(str(evaluation_id).strip(), "")

    @gl.public.view
    def get_board(self, limit: int = 20) -> str:
        raw = self.board.get("all")
        items = json.loads(raw) if raw else []
        n = int(limit)
        if n < 0:
            n = 0
        if n > MAX_BOARD:
            n = MAX_BOARD
        items = items[-n:] if n else []
        out = []
        for eid in reversed(items):
            blob = self.evaluations.get(eid)
            if blob is None:
                continue
            ev = json.loads(blob)
            out.append(
                {
                    "evaluation_id": ev["evaluation_id"],
                    "policy_id": ev["policy_id"],
                    "status": ev["status"],
                    "last_status": ev["last_status"],
                    "created_at": ev["created_at"],
                }
            )
        return json.dumps(out, sort_keys=True)

    @gl.public.view
    def get_fee_claimable(self, addr: str) -> str:
        return str(int(self.claimable.get(_to_account_str(addr), 0)))
