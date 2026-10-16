# Changelog

All notable changes to BEACON. Dates are UTC.

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
