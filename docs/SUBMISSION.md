# Submission

The Portal packet for BEACON. Every link below was checked live on
**2026-10-20**. If a link is not verified, it is not in this table.

## Evidence

| Field | Value |
|---|---|
| Project | **BEACON** — a frozen-policy status oracle |
| GitHub | https://github.com/Fortune9thx/beacon |
| Live app | https://beacon-six-zeta.vercel.app |
| Network | GenLayer Studio Dev, chain **61997** |
| Contract | `0x9479942AFE108A6fE3AA691224fAf21798f37185` |
| Explorer | https://explorer-studio-dev.genlayer.com/address/0x9479942AFE108A6fE3AA691224fAf21798f37185 |
| Deploy tx | `0x67933e326c6fa5cf514e7c88e885f61fe6285151ce6063de0559a82e019d4df7` |
| Deploy result | `ACCEPTED` (`MAJORITY_AGREE`) |
| Bundle | `contracts/build/Beacon.bundled.py`, 34 674 bytes, sha256 `507b11963e867607464f8f0bcee1cc7cb749eafc9f2ebed3bdc5f385786dd642` |
| Example policy | `uptime-sla` (fee 0, host allow-list `example.com`) |
| Example evaluation | `e1`, evidence `https://example.com/` |
| Example result | `NON_COMPLIANT`, `attempts=1`, full-content fingerprint recorded (tx `0xbd238319ec5c9d453c0688c83e1582194ed7313f221d7903ccf3f4396be39f60`) |
| Diverging round | `e1` first round `UNDETERMINED` (no validator majority); nothing written (tx `0x12ca333c9162f032abde1c5dce728d7292fba55398db750efc8f782123f53cc1`) |
| 404 evidence check | `e2`, `code=unreadable_evidence`, no model consultation (tx `0x43be66c50b8d9456f441cd71e378a7eef902c95d8c5733e1230725c73cc50e65`) |
| Refusal check | `cancel_stale("e999999")` → `FINISHED_WITH_ERROR` (tx `0x7ca7897c6857cc516f040a59381861277a2068ed28878554fa1ba1bd54649ceb`) |
| Tests | 105 passed; `ruff` clean; `genvm-lint lint` 3/3 |
| Reproduce | `node deploy/verify.mjs`; `node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py` |

## What GenLayer decides

One discrete status per evaluation:

```
COMPLIANT | NON_COMPLIANT | INCONCLUSIVE
```

Validators independently re-fetch the pinned evidence, apply the same
deterministic normalization and length rules, fingerprint the **full** document,
and re-run the same judgment. They agree on the status, the sorted source and clause sets,
and the fingerprints — never on prose. A diverging round writes nothing: live it
is `UNDETERMINED` and the evaluation is untouched. An agreed INCONCLUSIVE round
records the attempt and stays pending.

## What is at stake

Nothing is paid out on a status. The only value that moves is an optional
evaluation fee: it is held while an evaluation is pending, credited to the
fixed treasury when a status converges, and refunded in full to the recorded
requester if the evaluation never converges. There is no claim, appeal, dispute,
reimbursement or settlement surface — by design, not as a missing feature.

## Why it fails closed

- A non-200 response, an unreadable page, or a fetch error can only produce
  INCONCLUSIVE; the model is not consulted at all.
- A COMPLIANT with no cited source is downgraded to INCONCLUSIVE.
- If validators fetch different bytes (their fingerprints differ), they cannot
  agree: live the round is `UNDETERMINED` and writes nothing. The contract's
  caught-exception path records `code="no_consensus"` for an accepted write.
- Unknown or malformed model output is INCONCLUSIVE, never compliant.

## Known limitations (stated, not hidden)

- The live deployment has produced a converged **NON_COMPLIANT** but **not** a
  COMPLIANT. Studio Dev's preview model is intermittent; one round ended
  `UNDETERMINED` (no state written) before a retry converged. The COMPLIANT and
  source-less-COMPLIANT paths are covered by tests, not by a live status.
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
evidence and non-200 responses fail closed to INCONCLUSIVE without consulting
the model; a diverging round writes nothing. The live app is
https://beacon-six-zeta.vercel.app and the contract is
0x9479942AFE108A6fE3AA691224fAf21798f37185 on chain 61997. Live evidence: a
404 page resolved unreadable_evidence without consulting the model, a retry
converged NON_COMPLIANT, one round ended UNDETERMINED with no state written,
and a bounded write was refused by its precondition. 105 tests pass; the
bundle, deploy, verify and smoke checks are reproducible from the repo.
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
