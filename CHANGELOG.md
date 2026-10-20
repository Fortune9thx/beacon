# Changelog

All notable changes to BEACON. Dates are UTC.

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
