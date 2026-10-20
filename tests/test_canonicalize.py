"""Canonicalization: digests, JSON, addresses, and text hygiene."""

import pytest
from beaconlib import canonicalize as canon
from beaconlib.ssrf import BeaconError


def test_canonical_json_sorts_and_compacts():
    assert canon.canonical_json({"b": 1, "a": [2, 3]}) == '{"a":[2,3],"b":1}'


def test_policy_digest_is_stable_and_field_sensitive():
    base = {
        "policy_id": "main",
        "policy_text": "must publish a security.txt",
        "evidence_patterns": ["*.example.com"],
        "fee_amount": 100,
        "treasury": "0x" + "aa" * 20,
    }
    d1 = canon.policy_digest(**base)
    assert d1 == canon.policy_digest(**base)
    assert len(d1) == 64
    assert canon.policy_digest(**{**base, "policy_text": "something else"}) != d1
    assert canon.policy_digest(**{**base, "fee_amount": 101}) != d1
    # The treasury is part of the frozen identity.
    assert canon.policy_digest(**{**base, "treasury": "0x" + "cc" * 20}) != d1


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("0x" + "AB" * 20, "0x" + "ab" * 20),
        (("ab" * 20), "0x" + "ab" * 20),
        ("0xshort", ""),
        ("nonsense", ""),
        ("", ""),
    ],
)
def test_normalize_address(raw, expected):
    assert canon.normalize_address(raw) == expected


def test_sanitize_strips_fences_and_control_chars():
    out = canon.sanitize_untrusted("a`b\x00c\n\n d", 100)
    assert "`" not in out and "\x00" not in out
    assert out == "a b c d"


def test_sanitize_collapses_equals_runs():
    assert canon.sanitize_untrusted("=== END UNTRUSTED ===", 100) == "= END UNTRUSTED ="


def test_sanitize_preserves_ordinary_words():
    """Delimiter hygiene must never edit the words of a policy or a page.

    A sibling build once stripped the literal word END case-insensitively,
    silently turning "independently" into "indep ently" and changing the policy
    hash on a live deploy. This pins the narrower rule.
    """
    out = canon.sanitize_untrusted(
        "independently reviewed; END OF REPORT; BEGIN AGAIN; PASS", 200
    )
    for word in ("independently", "END", "BEGIN", "PASS"):
        assert word in out


def test_sanitize_truncates():
    out = canon.sanitize_untrusted("x" * 50, 10)
    assert out.startswith("x" * 10) and out.endswith("...")


def test_policy_id_normalization():
    assert canon.normalize_policy_id("Main-01") == "main-01"
    for bad in ["", "ab", "has space", "UPPER!", "x" * 65]:
        with pytest.raises(BeaconError):
            canon.normalize_policy_id(bad)


def test_policy_text_bounds():
    assert canon.normalize_policy_text("  hello  ") == "hello"
    with pytest.raises(BeaconError):
        canon.normalize_policy_text("x" * (canon.MAX_POLICY_CHARS + 1))
    with pytest.raises(BeaconError):
        canon.normalize_policy_text("")
