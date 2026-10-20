# Changelog

All notable changes to BEACON. Dates are UTC.

## 0.1.2 — 2026-10-20

- **Redeployed** to `0x9479942AFE108A6fE3AA691224fAf21798f37185` after correcting
  two internal docstrings/comments that described SSRF rules as re-applied at
  fetch time. Enforcement is request-time validation plus fetch-time
  normalization; executable behaviour is unchanged. Superseded addresses and
  reasons are in `deploy/deployments.json`.
- **Live:** an evaluation converged to `NON_COMPLIANT` (tx
  `0xbd238319ec5c9d453c0688c83e1582194ed7313f221d7903ccf3f4396be39f60`); a
  404-evidence evaluation resolved `unreadable_evidence` with no model
  consultation (tx
  `0x43be66c50b8d9456f441cd71e378a7eef902c95d8c5733e1230725c73cc50e65`); a
  diverging round was `UNDETERMINED` and wrote nothing (tx
  `0x12ca333c9162f032abde1c5dce728d7292fba55398db750efc8f782123f53cc1`); the
  refusal smoke check passed (tx
  `0x7ca7897c6857cc516f040a59381861277a2068ed28878554fa1ba1bd54649ceb`).
- Bundle 34 674 bytes, sha256
  `507b11963e867607464f8f0bcee1cc7cb749eafc9f2ebed3bdc5f385786dd642`.
- **Tests:** 105 passing.

## 0.1.1 — 2026-10-20

- **Fixed:** the judge now fetches with `gl.nondet.web.get` and normalizes on the
  explicit HTTP status instead of treating any rendered text as a 200 response.
  A 404/500 page can no longer be read as evidence, however compliant its prose
  looks. Regression: `test_non_200_response_is_not_read_as_evidence`; live
  proof in `docs/STATUS.md`.
- **Changed:** the frontend asks `estimateTransactionFeesForWrite` for the exact
  call and passes the whole fee object, falling back to the proven complete
  distribution. Reads that a write depends on get bounded retry and a deadline.
- **Added:** reproducible deploy tooling (`deploy/probe_schema.mjs`,
  `deploy/verify.mjs`, `deploy/deploy.mjs`, `deploy/smoke.mjs`), a root
  `package.json`, `gltest.config.yaml`, `run_lint.py`, and `AGENTS.md`.
- **Added:** `docs/SUBMISSION.md`, `docs/deployment.md`, an expanded
  `docs/audit.md` with the sibling-build cross-check and residual limitations,
  and a steward reading order.
- **Redeployed** to `0x3c9724cb1A3063798cd351C3cF8b748eE0E4834E`; the previous
  address is recorded with its reason in `deploy/deployments.json`.
- **Tests:** 105 passing.

## 0.1.0

Initial release.

- `Beacon` contract: five views (`get_config`, `get_policy`, `get_policy_ids`,
  `get_evaluation`, `get_board`, `get_fee_claimable`) and five writes
  (`create_policy`, `request_evaluation`, `evaluate`, `cancel_stale`,
  `claim_fees`).
- A three-status judgment (`COMPLIANT`, `NON_COMPLIANT`, `INCONCLUSIVE`) under a
  single `strict_eq` equivalence principle, agreed on the discrete status, the
  sorted source and clause sets, and the sha256 of every full document.
- Fail-closed rules: unreadable evidence short-circuits to INCONCLUSIVE; a
  source-less COMPLIANT is downgraded; no consensus writes nothing.
- SSRF confinement and host allow-listing; full-content fingerprinting.
- Optional evaluation fee: exact-value request, treasury credit on convergence,
  permissionless refund to the requester on a stalled evaluation.
- Vite + React + Tailwind interface, dark, in `frontend/`.
- Test suite against an in-process fake GenVM; bundle reproducibility checked in
  CI.
