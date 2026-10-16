"""Deterministic canonicalization: digests, canonical JSON, and text hygiene.

The policy hash is the contract's spine: it is computed when a policy is frozen
and re-bound to every evaluation of it, so a recorded status can never be read
against a policy that has since changed. That only means anything if the
derivation is byte-for-byte reproducible from the same inputs, so every piece of
it -- JSON key order, number encoding, whitespace -- is pinned here.

No genlayer imports.
"""

import hashlib
import json
import re

from .ssrf import fail

MAX_POLICY_CHARS = 4000
MAX_POLICY_ID_CHARS = 64
MAX_TOKEN_CHARS = 64

_FENCE_RE = re.compile(r"[`\u0000-\u0008\u000b\u000c\u000e-\u001f]")
_EQ_RUN_RE = re.compile(r"={2,}")
_WS_RE = re.compile(r"\s+")
_ADDR_RE = re.compile(r"^0x[0-9a-f]{40}$")
_POLICY_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{2,63}$")


def canonical_json(obj):
    """The one JSON encoding used for every digest and every comparable."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def sha256_hex(text):
    return hashlib.sha256(str(text).encode("utf-8")).hexdigest()


def digest_fields(fields):
    return sha256_hex(canonical_json(fields))


def policy_digest(policy_id, policy_text, evidence_patterns, fee_amount, treasury):
    """Digest of a policy's immutable content, frozen at registration.

    Every evaluation records this hash, so a status is always read against the
    exact policy it was judged under -- never a later edit, because there is no
    edit path and the hash would change if there were.
    """
    return digest_fields({
        "policy_id": str(policy_id),
        "policy_text": str(policy_text),
        "evidence_patterns": [str(p) for p in evidence_patterns],
        "fee_amount": int(fee_amount),
        "treasury": str(treasury),
    })


def _require_str(value, what, limit):
    if not isinstance(value, str):
        fail(what + " must be a string")
    s = value.strip()
    if not s:
        fail(what + " is required")
    if len(s) > limit:
        fail(what + " is too long")
    return s


def normalize_policy_id(value):
    s = _require_str(value, "policy id", MAX_POLICY_ID_CHARS).lower()
    if not _POLICY_ID_RE.match(s):
        fail("policy id must be 3-64 chars of a-z, 0-9, dash or underscore")
    return s


def normalize_policy_text(value):
    return _require_str(value, "policy", MAX_POLICY_CHARS)


def normalize_address(value):
    """Coerce anything address-shaped into the lowercase 0x-hex form stored here."""
    if isinstance(value, bytes):
        value = value.hex()
    s = str(value).strip().lower()
    if s and not s.startswith("0x"):
        s = "0x" + s
    return s if _ADDR_RE.match(s) else ""


def sanitize_untrusted(raw, limit):
    """Make hostile text safe to embed inside a fenced prompt block.

    Backticks and control characters are removed, then any run of two or more
    `=` is collapsed to one: the fence this text sits inside is a run of `=`,
    so text carrying its own `===` run could otherwise forge a closing marker
    and make whatever follows it read as instruction rather than quoted data.
    Finally the result is bounded, so one oversized page cannot crowd the rules
    out of the prompt.
    """
    if not isinstance(raw, str):
        raw = str(raw)
    t = _FENCE_RE.sub(" ", raw)
    t = _EQ_RUN_RE.sub("=", t)
    t = _WS_RE.sub(" ", t).strip()
    if len(t) > limit:
        t = t[:limit] + " ..."
    return t
