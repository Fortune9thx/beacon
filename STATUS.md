# Status

What is true right now, and what is not yet true. Nothing here is aspirational.

## Scorecard

| Claim                                        | State | Evidence |
| -------------------------------------------- | ----- | -------- |
| One contract, one nondet path                | done  | `contracts/Beacon.py`; `evaluate` holds the only `gl.eq_principle` call |
| Three-status taxonomy, fail closed           | done  | `beaconlib/judgment.py`; unreadable evidence short-circuits to INCONCLUSIVE |
| Status bound to full evidence                | done  | `build_fingerprints` digests the whole document; fingerprints are compared |
| Evidence confined (SSRF + allow-list)        | done  | `beaconlib/ssrf.py`; re-checked at fetch |
| Money exact beyond 2**53                     | done  | fee serialized as a decimal string |
| No claim/appeal/dispute/payout surface       | done  | `test_no_dispute_or_payout_surface` |
| Test suite green                             | done  | `102 passed` |
| Lint clean                                   | done  | `ruff check .` → All checks passed |
| Bundle reproducible                          | done  | `build_bundle.py`; `test_bundle_is_reproducible_from_source` |
| Contract safety lint                         | done  | `genvm-lint lint` → checked 3 |
| Interface builds                             | done  | `npm run typecheck`, `npm run build` |
| Deployed to Studio Dev                       | done  | `0x37Df9FD7167bDfAa357eDD3d493C1e8Bca5245a5` |
| Live schema verified on chain                | done  | `gen_getContractSchema` → 11 methods (6 view / 5 write) |
| Live non-payable write verified              | done  | `create_policy` accepted; `get_policy` returns the record |
| Live request + freeze verified               | done  | `request_evaluation` accepted; `get_evaluation` shows the frozen URLs and policy hash |
| Live nondet round verified                   | done  | `evaluate` accepted; the round fetched, fingerprinted, and failed closed |
| Pushed to GitHub                             | done  | https://github.com/Fortune9thx/beacon |
| Deployed frontend URL                        | done  | https://beacon-six-zeta.vercel.app |

## Deployment

- **Contract:** `0x37Df9FD7167bDfAa357eDD3d493C1e8Bca5245a5` on GenLayer Studio
  Dev, chain `61997`.
- **Deploy tx:** `0xaad69a2b4b54e9fc8b6400476555128dc3478a700c2caa95d063c000886c458e`,
  result `ACCEPTED`.
- **Bundle:** `contracts/build/Beacon.bundled.py`, sha256
  `c79e3b10bdc5c257c1fc907ddcda43f2cfd3c88232112d321200d1e3746bf2fb`, 33985 bytes.
- **Live read:** `get_config` returns `max_attempts=5`,
  `stale_timeout_seconds=86400`, `max_evidence_urls=5`, and owner/treasury at the
  deployer address (`0xc6e6…e537`). `gen_getContractSchema` lists all eleven
  methods.
- **Live writes:** `create_policy` (policy `uptime-sla`, fee `0`) accepted;
  `get_policy_ids` → `["uptime-sla"]`; `get_policy` returns the frozen record
  with its `policy_hash`. `request_evaluation` accepted; `get_board` shows `e1`
  `PENDING` and `get_evaluation` shows the frozen `evidence_urls`
  (`["https://example.com/"]`) and the request-time `policy_hash`.
- **Live nondet round:** `evaluate` accepted; the record after two rounds shows
  `attempts=2`, `last_status=INCONCLUSIVE`, `code="inconclusive"`, and
  `fingerprints=[[0, "43338e32beb5871d10be1ac1816172af356bb5a731591005220a4bd4043c5ca4"]]`
  — the full-content sha256 of the fetched page — while `status` stays
  `PENDING`. The round fetched, fingerprinted, and failed closed exactly as
  designed.
- **Interface:** https://beacon-six-zeta.vercel.app — the contract address
  (`0x37Df…45a5`) is embedded in the deployed bundle and was verified present in
  the served JavaScript.
- **Repository:** https://github.com/Fortune9thx/beacon.
- **CI:** the contract job (ruff, pytest, bundle reproducibility, `genvm-lint
  lint`) and the frontend job (typecheck, build) run on every push.

## Live-proven vs test-only

- **Observed on chain:** deploy, `gen_getContractSchema`, `get_config`,
  `get_policy_ids`, `get_policy`, `create_policy`, `request_evaluation`,
  `get_board`, `get_evaluation`, and one `evaluate` round that fetched and
  fingerprinted a live URL under consensus.
- **Not yet observed on chain:** a converging `COMPLIANT` or `NON_COMPLIANT`
  status, `cancel_stale`, and `claim_fees` with a nonzero fee. These are covered
  by the test suite (`test_evaluate_compliant_is_terminal_and_routes_fee`,
  `test_cancel_refunds_after_attempts`, `test_claim_fees_is_treasury_only_and_once`)
  but are not claimed as live.
- The stale-refund window is 24h by design, so it cannot be exercised against a
  fresh evaluation without waiting.

## Studio Dev determinism note

Studio Dev's nondeterministic model intermittently returns malformed JSON, so
`exec_prompt(..., response_format="json")` yields output that `_safe_json`
cannot parse; the round then fails closed to `INCONCLUSIVE` with code
`inconclusive`, records the attempt, and leaves the evaluation `PENDING`. This
is a property of the preview network, not of the contract — and it is precisely
the path the fail-closed design covers: a round the model cannot answer cleanly
never becomes a status. The remedy is to call `evaluate` again; only a round
that reaches agreement on a clean record changes state.

Studio Dev is a preview network whose state resets. If the schema stops
resolving, treat BEACON as undeployed until it is redeployed — the interface
does this on its own.
