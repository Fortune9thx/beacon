# Status

What was actually verified, and when. If something was not run, it says so here
rather than implying coverage. Keep it honest.

_Last updated: 2026-10-20._

## Live

- **Contract:** `0x3c9724cb1A3063798cd351C3cF8b748eE0E4834E` on GenLayer Studio
  Dev (chain 61997).
- **Deploy tx:** `0xc10a6f680c3122bd36fb4572d4645aa8f985de139ba8cc41c472ee723f92d27f`
  (consensus `ACCEPTED`, `MAJORITY_AGREE`).
- **Bundle:** `contracts/build/Beacon.bundled.py`, 34 630 bytes, sha256
  `4764cba4d0537672019fa75a97831aad47443bd620b95b30f4236bf236cc7d0e`.
- **App:** https://beacon-six-zeta.vercel.app. The deployed JS is checked for
  the address after redeploy; `VITE_CONTRACT_ADDRESS` is inlined at build time.
- **Treasury / owner:** `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537`.

## Verified

| Check | Result |
|---|---|
| `python -m pytest` | **105 passed** (in-process fake GenVM, no network) |
| `ruff check .` | All checks passed |
| `genvm-lint lint contracts/build/Beacon.bundled.py` | PASS (3 checks) |
| Bundle reproducibility | CI rebuilds and diffs the committed artifact |
| `node deploy/probe_schema.mjs` | PASS â€” schema + Depends resolve on 61997 |
| `node deploy/verify.mjs` | PASS â€” 11 methods; constants, owner/treasury, bundle bytes/sha256 |
| `node deploy/smoke.mjs` | PASS â€” live write refused by its precondition (see below) |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix frontend run build` | PASS (tsc + vite) |

### Live reads

`gen_getContractSchema` lists **11 methods (6 view, 5 write)**. `get_config`
returns `max_attempts=5`, `stale_timeout_seconds=86400`,
`max_evidence_urls=5`, and the expected owner/treasury. `get_policy_ids` and
`get_board` are JSON lists. `deploy/verify.mjs` re-checks all of this from
`deploy/deployments.json`, including that the recorded bundle digest still
matches the committed artifact.

### Live writes

- `create_policy("uptime-sla", â€¦)`, fee `0` â€” **ACCEPTED**; `get_policy_ids`
  returns `["uptime-sla"]` and `get_policy` returns the frozen record and
  `policy_hash` `436bfd85â€¦c7d`.
- `request_evaluation("uptime-sla", ["https://example.com/"])` â€” **ACCEPTED**;
  `e1` freezes the URL, policy hash, requester and fee.
- `request_evaluation("uptime-sla", ["https://example.com/definitely-not-a-real-page-404"])`
  â€” **ACCEPTED**; `e2` freezes the 404 URL.
- `evaluate("e1")` twice â€” **ACCEPTED**; `e1` stays `PENDING` with `attempts=2`,
  `last_status=INCONCLUSIVE`, `code="inconclusive"`, and the full-content
  fingerprint `[[0, "06fe21c5fbf716d5b7fc1ef87cd418a375d9523ad36a951a1e3182a8f42526af"]]`.
  The second round's tx:
  `0x585029365e54eb04e028777ef5d37334de547b6773de883f7f6acd40876783b7`.
- `evaluate("e2")` â€” **ACCEPTED**; `e2` stays `PENDING` with `attempts=1`,
  `last_status=INCONCLUSIVE`, `code="unreadable_evidence"`, and fingerprint
  `[[0, "da3c01050b1f352b33853bf17e408ba64e0b14423d4f7137a20906ed2e58e679"]]`.
  Tx: `0xe06cdee0a4107926577ed0fcfeb43b3f706b404f17c79cca87a0eb1eda581494`.
- `cancel_stale("e999999")` â€” **ACCEPTED with `FINISHED_WITH_ERROR`** on the
  leader: the deployed bytecode executed a write and its precondition refused an
  unknown evaluation. Tx:
  `0xa24012cf0d65d6cbde996c0bdb87953b37ddf1f2bd1a81f2bdfa758037f6dbdc`.

### What the 404 evaluation proves

The 200-OK page produced a fingerprint and consulted the model (which returned
malformed JSON on this preview network, so the round failed closed). The 404
page produced `code="unreadable_evidence"` with **no model consultation**. That
is the S1 fix working on chain: the fetch is judged on its HTTP status, not
merely on the fact that bytes came back. A 404 page that happens to say
"COMPLIANT" cannot decide a status.

## NOT verified â€” state this plainly

- **No live converged `COMPLIANT` or `NON_COMPLIANT`.** Studio Dev's model
  intermittently returns malformed JSON; both `e1` rounds failed closed. The
  converged paths are covered by tests, not by a live status.
- **No live nonzero fee movement.** The live policies use a zero fee. The CLI's
  `write` has no option to attach a payable value, so `request_evaluation` with a
  nonzero fee, `claim_fees` with a balance, and a `cancel_stale` refund have not
  been driven on chain. They are covered by tests.
- **No direct GenVM test suite.** The pinned runner asset is not reliably
  fetchable from a cold checkout. The suite runs against an in-process fake
  runtime that executes `strict_eq` twice (leader and validator), so the
  agreement/disagreement boundary is exercised rather than assumed.
- **Frontend wallet flow not exercised in a live wallet session.** The app was
  built and deployed, and its served JS was checked for the contract address.

## Superseded deployment

`0x37Df9FD7167bDfAa357eDD3d493C1e8Bca5245a5` (tx
`0xaad69a2b4b54e9fc8b6400476555128dc3478a700c2caa95d063c000886c458e`) was live
and passed the same schema/constant checks, but its judge called
`web.render(mode="text")` and treated any successful return as HTTP 200. It was
replaced during the accepted-build audit. The full reason is in
`deploy/deployments.json`, which is the only place the live address lives.

## Studio Dev determinism note

Studio Dev's nondeterministic model intermittently returns malformed JSON, so
`exec_prompt(..., response_format="json")` yields output that `_safe_json`
cannot parse; the round then fails closed to `INCONCLUSIVE`, records the
attempt, and leaves the evaluation `PENDING`. This is a property of the preview
network, not of the contract â€” and it is the path the fail-closed design covers:
a round the model cannot answer cleanly never becomes a status. The remedy is to
call `evaluate` again; only a round that reaches agreement on a clean record
changes state.

Studio Dev is a preview network whose state resets. If the schema stops
resolving, treat BEACON as undeployed until it is redeployed â€” the interface
does this on its own.

## Toolchain

- Python 3.12.10, pytest 9.1.1, genvm-linter 0.11.1rc2
- genlayer-py 0.19.0rc2, genlayer-test 0.30.0rc2
- genlayer-js 2.0.0-rc.1, Node v22.16.0
- Deploy signer: unlocked local keystore (address only, never printed)
