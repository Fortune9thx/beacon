# Audit

A self-review of the properties BEACON claims, each tied to the test that pins
it. Where a property is not proven on chain, it says so; see
[../STATUS.md](../STATUS.md) for the live-versus-test boundary.

## Fail-closed judgment

| Property | Pinned by |
| -------- | --------- |
| An unreadable document can only yield INCONCLUSIVE; the model is never consulted | `test_unreadable_evidence_forces_inconclusive`, `test_evaluate_unreadable_evidence_is_inconclusive` |
| COMPLIANT without a cited source is downgraded to INCONCLUSIVE | `test_compliant_without_sources_is_downgraded` |
| A consensus exception fails closed to INCONCLUSIVE | `test_evaluate_consensus_exception_fails_closed` |
| Divergent fingerprints (two validators read different bytes) become INCONCLUSIVE | `test_evaluate_conflicting_fingerprints_is_inconclusive` |
| Unknown or malformed model output is INCONCLUSIVE, never compliant | `test_canon_status_synonyms_and_fail_closed` |

## Evidence integrity

| Property | Pinned by |
| -------- | --------- |
| The fingerprint covers the full document, past the bounded excerpt | `test_digest_covers_content_past_the_excerpt_cap` |
| Fingerprints are sorted `[index, sha256]` pairs and change with content | `test_fingerprints_are_sorted_pairs_and_track_content` |
| The comparison record is canonical (stable key order, sorted sets) | `test_comparable_json_is_canonical` |
| Cited sources are bounded, de-duplicated and sorted | `test_sources_bounded_deduped_sorted` |
| Cited clauses are intersected with the policy's allowed clauses | `test_clauses_intersected_with_allowed` |

## Evidence confinement (SSRF)

| Property | Pinned by |
| -------- | --------- |
| Only public https URLs on the default port are accepted | `test_accepts_public_https`, `test_rejects_with_reason` |
| The host allow-list is enforced before any fetch | `test_normalize_evidence_urls_enforces_patterns` |
| Wildcards match subdomains and the apex; exact patterns match only exact | `test_pattern_wildcard_matches_subdomains_and_apex`, `test_pattern_exact_matches_only_exact` |
| URL count and length are bounded and de-duplicated | `test_normalize_evidence_urls_bounds_and_dedupes`, `test_rejects_overlong_url` |

## Prompt-injection surface

| Property | Pinned by |
| -------- | --------- |
| Fetched content is fenced as untrusted and control characters are stripped | `test_prompt_fences_hostile_content`, `test_sanitize_strips_fences_and_control_chars` |
| Script bodies are dropped from rendered HTML | `test_strip_html_drops_script_bodies` |

## State machine

| Property | Pinned by |
| -------- | --------- |
| The fee must equal the attached value exactly; the contract never strands value | `test_request_requires_exact_fee`, `test_request_zero_fee_policy` |
| A COMPLIANT / NON_COMPLIANT round is terminal and routes the fee to treasury | `test_evaluate_compliant_is_terminal_and_routes_fee`, `test_evaluate_non_compliant_is_terminal` |
| The attempt cap blocks further rounds and opens the refund path | `test_evaluate_refused_after_attempt_cap`, `test_cancel_refunds_after_attempts` |
| A freshly created evaluation cannot be cancelled | `test_cancel_refused_while_fresh` |
| A 24h-stale evaluation can be cancelled and refunded | `test_cancel_refunds_after_timeout` |
| A terminal evaluation cannot be cancelled | `test_cancel_refuses_terminal_evaluation` |
| `claim_fees` is treasury-only and pays at most once | `test_claim_fees_is_treasury_only_and_once` |
| A zero-fee evaluation owes nothing | `test_zero_fee_evaluation_owes_nothing` |
| The policy hash binds the frozen text, hosts, fee and treasury | `test_policy_hash_binds_frozen_content` |

## Surface

| Property | Pinned by |
| -------- | --------- |
| There is no claim, appeal, dispute, payout or settlement method | `test_no_dispute_or_payout_surface` |
| Only one contract class exists in the deployable | `test_bundle_has_exactly_one_contract_class` |

## Trust boundaries

- **The requester names the evidence.** BEACON does not fetch on its own
  initiative; it judges the URLs it was handed, within the sponsor's host
  allow-list. Choosing the evidence is the requester's act.
- **The sponsor names the rule.** The policy is immutable after creation; a
  changed rule is a new policy with a new hash.
- **The treasury is fixed at deploy.** It is stored on the contract and frozen
  into every policy hash; a policy's fees can only ever go to it.
- **Downstream readers trust the status, not BEACON.** The record carries the
  policy hash, the fingerprints and the timestamps precisely so a reader can
  check the basis of the status rather than take it on faith.

## Not claimed

- BEACON does not verify that the sponsor's policy is *good*, only that the
  evidence is applied to it consistently.
- BEACON does not prove the fetched document is the "true" version of a page;
  it proves that validators independently agreed on its content by fingerprint.
- No round can rescue an INCONCLUSIVE into a status; that is by design.
