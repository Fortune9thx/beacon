# Submission

The Portal packet for BEACON. Every link below was checked live on
**2026-10-20**. If a link is not verified, it is not in this table.

## Evidence

| Field | Value |
|---|---|
| Project | **BEACON** â€” a frozen-policy status oracle |
| GitHub | https://github.com/Fortune9thx/beacon |
| Live app | https://beacon-six-zeta.vercel.app |
| Network | GenLayer Studio Dev, chain **61997** |
| Contract | `0x3c9724cb1A3063798cd351C3cF8b748eE0E4834E` |
| Explorer | https://explorer-studio-dev.genlayer.com/address/0x3c9724cb1A3063798cd351C3cF8b748eE0E4834E |
| Deploy tx | `0xc10a6f680c3122bd36fb4572d4645aa8f985de139ba8cc41c472ee723f92d27f` |
| Deploy result | `ACCEPTED` (`MAJORITY_AGREE`) |
| Bundle | `contracts/build/Beacon.bundled.py`, 34 630 bytes, sha256 `4764cba4d0537672019fa75a97831aad47443bd620b95b30f4236bf236cc7d0e` |
| Example policy | `uptime-sla` (fee 0, host allow-list `example.com`) |
| Example evaluation | `e1`, evidence `https://example.com/` |
| Example result | `PENDING`, `attempts=2`, `last_status=INCONCLUSIVE`, `code=inconclusive`, full-content fingerprint recorded |
| 404 evidence check | `e2`, `code=unreadable_evidence`, no model consultation |
| Refusal check | `cancel_stale("e999999")` â†’ `FINISHED_WITH_ERROR` (tx `0xa24012cf0d65d6cbde996c0bdb87953b37ddf1f2bd1a81f2bdfa758037f6dbdc`) |
| Tests | 105 passed; `ruff` clean; `genvm-lint lint` 3/3 |
| Reproduce | `node deploy/verify.mjs`; `node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py` |

## What GenLayer decides

One discrete status per evaluation:

```
COMPLIANT | NON_COMPLIANT | INCONCLUSIVE
```

Validators independently re-fetch the pinned evidence, apply the same
deterministic SSRF/length rules, fingerprint the **full** document, and re-run
the same judgment. They agree on the status, the sorted source and clause sets,
and the fingerprints â€” never on prose. No agreement means no status; the round
fails closed to INCONCLUSIVE.

## What is at stake

Nothing is paid out on a status. The only value that moves is an optional
evaluation fee: it is held while an evaluation is pending, credited to the
fixed treasury when a status converges, and refunded in full to the recorded
requester if the evaluation never converges. There is no claim, appeal, dispute,
reimbursement or settlement surface â€” by design, not as a missing feature.

## Why it fails closed

- A non-200 response, an unreadable page, or a fetch error can only produce
  INCONCLUSIVE; the model is not consulted at all.
- A COMPLIANT with no cited source is downgraded to INCONCLUSIVE.
- If validators fetch different bytes (their fingerprints differ), the round
  becomes INCONCLUSIVE with `code="no_consensus"`.
- Unknown or malformed model output is INCONCLUSIVE, never compliant.

## Known limitations (stated, not hidden)

- The live deployment has **not** produced a converged COMPLIANT or
  NON_COMPLIANT. Studio Dev's preview model intermittently returns malformed
  JSON, so live rounds have failed closed; the converged paths are covered by
  tests.
- No live nonzero fee has moved (the CLI cannot attach a payable value); fee
  accounting is covered by tests.
- The requester chooses the evidence within the sponsor's host allow-list.
  BEACON proves validators agreed on the content, not that the page is the
  "true" version of anything.
- Studio Dev is a preview network that can reset; see `docs/STATUS.md`.

## Notes field (verbatim)

```text
BEACON is a frozen-policy status oracle. A sponsor registers an immutable
policy, its evidence-host allow-list, and an optional fee. A requester pins
evidence URLs; validators independently re-fetch them, fingerprint the full
documents, and agree on exactly one status: COMPLIANT, NON_COMPLIANT, or
INCONCLUSIVE. There is no payout, appeal, or dispute surface. Unreadable
evidence, a non-200 response, missing citations, or missing consensus all fail
closed to INCONCLUSIVE; only a clean, agreed record is stored. The live app is
https://beacon-six-zeta.vercel.app and the contract is
0x3c9724cb1A3063798cd351C3cF8b748eE0E4834E on chain 61997. Live evidence: a
404 page resolved unreadable_evidence without consulting the model, and a
bounded write was refused by its precondition. 105 tests pass; the bundle,
deploy, verify and smoke checks are reproducible from the repo.
```

## Verification commands

```bash
python contracts/build_bundle.py
python -m pytest
ruff check .
genvm-lint lint contracts/build/Beacon.bundled.py
node deploy/verify.mjs
node deploy/smoke.mjs
npm --prefix frontend run build
```
