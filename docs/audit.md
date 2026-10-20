# Audit â€” self-review

Scope: `contracts/Beacon.py` + `contracts/beaconlib/*` (the bundled deployable),
the deploy tooling, and the frontend's read/write path. Method: source review
against the product law and the nondet boundary; 105 tests; `genvm-lint`; a live
schema/constant verification; live writes on the deployed address; and a
cross-check against the recorded bug histories of five sibling GenLayer builds.
This is a self-audit, not an independent third party.

See [STATUS.md](STATUS.md) for the live-versus-test boundary.

## Value-moving paths â€” traced

The only value the contract holds is an optional evaluation fee.

1. `request_evaluation` is payable and requires the attached value to equal the
   policy fee **exactly**. An overpayment reverts rather than being stranded; an
   underpayment reverts.
2. `evaluate` on `COMPLIANT`/`NON_COMPLIANT` credits the fee to
   `self.treasury.as_hex`. Credits only; no transfer. Lowercased by `_credit`.
3. `cancel_stale` sets `CANCELLED` before transferring, and transfers only to
   the evaluation's recorded `requester`. A stranger may trigger it but cannot
   redirect it.
4. `claim_fees` is treasury-only, zeroes `claimable[sender]` **before** the
   transfer, and pays only the caller. This is the only outbound fee path.
5. An `INCONCLUSIVE` round credits nothing, holds the fee, and leaves the
   evaluation `PENDING`; it never pays and never refunds.

Checked: the contract cannot both route and refund one fee â€” `evaluate` makes a
converged status terminal, `cancel_stale` requires `PENDING`, and `claim_fees`
reads a balance that is zeroed before its transfer. A zero-fee evaluation has no
value to move.

## Nondet boundary â€” checked

`evaluate` holds exactly one `gl.eq_principle.strict_eq` call. The closure it is
handed (`judge`) performs every fetch and the single `exec_prompt`; it touches no
`self.*` storage, closing only over locals copied before the call. `strict_eq`
re-runs `judge` on the leader and independently on every validator and compares
the returned canonical strings. The comparison includes the full-content
fingerprints, so agreement means the validators fetched the same bytes, not just
reached the same class of answer. Storage is re-read on each call; the agreed
record is parsed defensively and falls back to the fail-closed record.

`_now()` reads `gl.message.raw["datetime"]`, which every validator re-executing
the call sees identically.

## Fail-closed judgment

| Property | Pinned by |
| -------- | --------- |
| An unreadable document can only yield INCONCLUSIVE; the model is never consulted | `test_unreadable_evidence_forces_inconclusive`, `test_evaluate_unreadable_evidence_is_inconclusive` |
| A non-200 response is unreadable, even if its body looks compliant | `test_non_200_response_is_not_read_as_evidence` |
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
| Sanitization removes delimiters, not ordinary words | `test_sanitize_preserves_ordinary_words` |
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
| Credits and claimable reads share one lowercase address form | `test_fee_claimable_normalizes_address_case` |
| A zero-fee evaluation owes nothing | `test_zero_fee_evaluation_owes_nothing` |
| The policy hash binds the frozen text, hosts, fee and treasury | `test_policy_hash_binds_frozen_content` |

## Surface

| Property | Pinned by |
| -------- | --------- |
| There is no claim, appeal, dispute, payout or settlement method | `test_no_dispute_or_payout_surface` |
| Only one contract class exists in the deployable | `test_bundle_has_exactly_one_contract_class` |

## Findings

### S1 â€” a non-200 page could be read as evidence (fixed; redeployed)

**Severity:** correctness. The original `judge` called
`gl.nondet.web.render(url, mode="text")` and then `normalize_evidence(url, 200,
response)` â€” a hardcoded 200. Any successful return was treated as a readable
page. If a host answers a missing path with a 200-styled error document (or the
renderer does not raise on a non-2xx response), a 404/500 page whose prose says
"fully compliant" could decide a status. The in-process mock raises on non-200,
which is why the suite did not expose the gap.

**Fix:** `judge` now calls `gl.nondet.web.get(url)`, reads `status` and `body`
explicitly, and passes both to `normalize_evidence`. A non-200 response is
unreadable, which short-circuits to INCONCLUSIVE before the model is consulted.
`normalize_evidence` already decodes `bytes` and fingerprints the full stripped
text, so this also closes the sibling builds' "body is bytes" class without
feeding a raw body to a str-only sanitizer.

**Regression:** `test_non_200_response_is_not_read_as_evidence` (404 body says
"COMPLIANT", model returns COMPLIANT, and the evaluation must still be
INCONCLUSIVE with `code="unreadable_evidence"` and no prompt).

**Live proof:** on the deployed contract, `e2` pinned
`https://example.com/definitely-not-a-real-page-404`; `evaluate("e2")` returned
`INCONCLUSIVE`, `code="unreadable_evidence"`, and the model was not consulted.
The 200-OK page in `e1` did reach the model and recorded a fingerprint. See
`docs/STATUS.md`.

### S2 â€” the frontend carried a hardcoded fee preset only (fixed)

**Severity:** reliability, not security. The contract was never at risk; a write
carrying a stale or partial distribution is rejected client-side before
broadcast. The frontend now calls `estimateTransactionFeesForWrite` for the exact
call and passes the whole returned object, falling back to the proven complete
distribution if estimation fails. This is the accepted sibling pattern with a
belt-and-braces fallback; the deploy and smoke scripts keep the proven
distribution because they drive the CLI, not the SDK.

### S3 â€” `render` vs `get` and validator independence (verified, not a bug)

`strict_eq` is the standard primitive: it runs the closure on the leader and
again on every validator, so each side fetches and judges independently. The
fake runtime in the tests does the same two runs and raises on disagreement;
`test_evaluate_conflicting_fingerprints_is_inconclusive` exercises that path.
There is no separate `validator_fn` closure to test (unlike the sibling builds),
because the equivalence principle owns the comparison.

### S4 â€” address case normalization (verified, not a bug)

`_credit` lowercases its key, `claim_fees` compares and reads the lowercased
sender, and `get_fee_claimable` normalizes either an `Address` or a string to
lowercase. A checksummed key cannot silently read zero and strand a fee;
`test_fee_claimable_normalizes_address_case` pins the mixed-case lookup.

## Cross-check against sibling builds

| Recorded trap | BEACON status |
| --- | --- |
| `eth_getCode` is not a liveness probe | Uses `gen_getContractSchema` in the app and the scripts |
| CLI has no 61997 preset | Every CLI call passes `--rpc`; scripts use `studioDevnet` (61997) |
| Zero/partial fee distribution â†’ `FeeValueMustBeNonZero(1)` | Frontend estimates the whole fee object with a proven fallback; scripts pass the proven complete distribution |
| Constructor address must be bare/unquoted | `deploy.mjs` spawns with an argv array (no shell) |
| Generated bundle must be reproducible | CI rebuilds and diffs; bundler asserts Depends-first, no BOM, no dropped imports |
| gltest plugin blocks collection | `pytest.ini` disables both plugins; `gltest.config.yaml` is present for direct runs |
| `VITE_*` is inlined at build time | Redeploy with cache disabled; served JS is checked for the address |
| `Response.body` is bytes | `normalize_evidence` decodes bytes; `get` is used rather than feeding a raw body to a str-only sanitizer |
| Sanitizers corrupt ordinary words | Only fence/control sequences and `==` runs are altered; no word removal |
| Validator closure never executed | The fake runtime runs `strict_eq` twice; divergence fails closed |
| Address case mismatch zeroes a balance | Every write/read normalizes to lowercase; mixed-case test |
| Finality gating on writes | Every write requires `FINALIZED` in the UI; allow-list outcome check |
| Execution result treated as success | The UI allow-lists `FINISHED_WITH_RETURN` + `AGREE`/`MAJORITY_AGREE` + `ACCEPTED`/`FINALIZED` |
| Unbounded escape hatch | Cap (5 attempts) **and** 24h timeout; refund only to the requester |
| Single-source verdict | Out of scope for this product: a policy may legitimately rest on one pinned page. Disclosed below. |
| Evidence identity binding | Out of scope: the sponsor names the hosts, the requester names the page. BEACON proves agreement on content, not topical truth. Disclosed below. |

## Residual limitations â€” accepted, documented

| Risk | Mitigation | Residual |
| --- | --- | --- |
| A requester pins favorable evidence within the sponsor's hosts | Host allow-list, full-content fingerprints, sponsor-chosen policy | BEACON does not verify that the page is the "right" page for the subject, or that the policy is good |
| A single evidence page can decide a status | The model must cite a readable source; a source-less COMPLIANT is downgraded | A one-page policy is allowed by design; requiring two would break legitimate simple policies |
| Studio Dev's model returns malformed JSON | `_safe_json` fails closed to INCONCLUSIVE; attempts are recorded | Live converged statuses are rare on the preview network; tests cover the converged paths |
| Studio Dev resets | `deployments.json` + `gen_getContractSchema` liveness; app reports `no-code` | A reset requires a redeploy and a frontend redeploy |
| No direct GenVM runner tests | In-process fake executes the real contract source and runs `strict_eq` twice | The runner environment itself is not exercised locally; the standard primitive is the gate |
| Fee movement is not live-proven | Exact-value request, credit-once accounting, zero-before-transfer tests | The CLI cannot attach a payable value, so a nonzero live fee path is untested on chain |
| The deployer key is a local keystore | Never printed or committed; address only in docs | Loss of the keystore means the treasury can no longer claim; a redeploy from the project key restores a claimable treasury |
| Timestamps come from the message | Validators see the same message datetime | The 24h window is pinned to this `Depends` hash |

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
- No live nonzero fee has moved; see `STATUS.md`.

## What is deliberately simple

No upgradeability, no admin key over a policy, no appeal, no dispute, no payout,
no caller-proposed status. One contract, one nondet path, five writes, six views.
The money surface is a single optional fee with one outbound function.
