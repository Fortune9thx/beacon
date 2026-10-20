# Status

What was actually verified, and when. If something was not run, it says so here
rather than implying coverage. Keep it honest.

_Last updated: 2026-10-20._

## Live

- **Contract:** `0x9479942AFE108A6fE3AA691224fAf21798f37185` on GenLayer Studio
  Dev (chain 61997).
- **Deploy tx:** `0x67933e326c6fa5cf514e7c88e885f61fe6285151ce6063de0559a82e019d4df7`
  (consensus `ACCEPTED`, `MAJORITY_AGREE`).
- **Bundle:** `contracts/build/Beacon.bundled.py`, 34 674 bytes, sha256
  `507b11963e867607464f8f0bcee1cc7cb749eafc9f2ebed3bdc5f385786dd642`.
- **App:** https://beacon-six-zeta.vercel.app. After the redeploy, the served
  asset was fetched and checked: it contains the new address and not the
  superseded one. `VITE_CONTRACT_ADDRESS` is inlined at build time.
- **Treasury / owner:** `0xC6E6d3b2acCaECeCeB40Ad4bD3dF123DDCB4e537`.

## Verified

| Check | Result |
|---|---|
| `python -m pytest` | **105 passed** (in-process fake GenVM, no network) |
| `ruff check .` | All checks passed |
| `genvm-lint lint contracts/build/Beacon.bundled.py` | PASS (3 checks) |
| Bundle reproducibility | CI rebuilds and diffs the committed artifact |
| `node deploy/probe_schema.mjs` | PASS — schema + Depends resolve on 61997 |
| `node deploy/verify.mjs` | PASS — 11 methods; constants, owner/treasury, bundle bytes/sha256 |
| `node deploy/smoke.mjs` | PASS — live write refused by its precondition (see below) |
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

- `create_policy("uptime-sla", …, fee 0)` — **ACCEPTED** (tx
  `0x073f368eeff5980bcb5e65a048fddea01e2fcf6c5641f82e6bdeebfa2d44ccd1`);
  `get_policy_ids` returns `["uptime-sla"]` and `get_policy` returns the frozen
  record with `policy_hash` `a4b5a6df…e300c`.
- `request_evaluation("uptime-sla", ["https://example.com/"])` — **ACCEPTED**
  (tx `0x50b0fde8e11ccaf73eaa4d1a96ab1a5aa0c4ff6b04f2e53ae04073646733172a`);
  `e1` freezes the URL, policy hash, requester and fee.
- `request_evaluation("uptime-sla", ["https://example.com/definitely-not-a-real-page-404"])`
  — **ACCEPTED** (tx
  `0x4b5f0a6157e75ba8073a5ee6ffbbfee068704e6134b9f4d89dc80fa10eb704a9`);
  `e2` freezes the 404 URL.
- `evaluate("e2")` — **ACCEPTED** (tx
  `0x43be66c50b8d9456f441cd71e378a7eef902c95d8c5733e1230725c73cc50e65`);
  `e2` stays `PENDING` with `attempts=1`, `last_status=INCONCLUSIVE`,
  `code="unreadable_evidence"`, and fingerprint
  `[[0, "da3c01050b1f352b33853bf17e408ba64e0b14423d4f7137a20906ed2e58e679"]]`.
  The model was not consulted.
- `evaluate("e1")` — one round ended **UNDETERMINED** (ledger shows the leader
  returned `COMPLIANT` but no validator majority; tx
  `0x12ca333c9162f032abde1c5dce728d7292fba55398db750efc8f782123f53cc1`). Nothing
  was written: `attempts` stayed `0` and the evaluation stayed `PENDING`. A retry
  was **ACCEPTED** (tx
  `0xbd238319ec5c9d453c0688c83e1582194ed7313f221d7903ccf3f4396be39f60`) and
  converged to `NON_COMPLIANT`: `attempts=1`, `code="non_compliant"`, fingerprint
  `[[0, "06fe21c5fbf716d5b7fc1ef87cd418a375d9523ad36a951a1e3182a8f42526af"]]`,
  `supporting_sources=[]` (a NON_COMPLIANT needs no citation; only a
  source-less COMPLIANT is downgraded).
- `cancel_stale("e999999")` — **ACCEPTED with `FINISHED_WITH_ERROR`** (tx
  `0x7ca7897c6857cc516f040a59381861277a2068ed28878554fa1ba1bd54649ceb`): the
  deployed bytecode executed a write and its precondition refused an unknown
  evaluation.

### Consensus behaviour seen live

An `UNDETERMINED` round is not an `INCONCLUSIVE` result. `UNDETERMINED` writes
nothing and does not consume an attempt; an agreed INCONCLUSIVE round records
the attempt and leaves the evaluation `PENDING`. Both fail closed: neither
stores a status.

### What the 404 evaluation proves

The 200-OK page produced a fingerprint and, on retry, converged to
`NON_COMPLIANT`. The 404 page produced `code="unreadable_evidence"` with **no
model consultation**. That is the S1 fix working on chain: the fetch is judged
on its HTTP status, not merely on the fact that bytes came back. A 404 page that
happens to say "COMPLIANT" cannot decide a status. The earlier `UNDETERMINED`
round shows the same boundary from the other side: disagreement stores nothing
at all.

## NOT verified — state this plainly

- **No live `COMPLIANT`.** `NON_COMPLIANT` converged once; a COMPLIANT outcome
  and the source-less-COMPLIANT downgrade have not been driven live. Studio
  Dev's preview model is intermittent, and one round here ended `UNDETERMINED`
  rather than INCONCLUSIVE (see above).
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

## Superseded deployments

- `0x3c9724cb1A3063798cd351C3cF8b748eE0E4834E` (tx
  `0xc10a6f680c3122bd36fb4572d4645aa8f985de139ba8cc41c472ee723f92d27f`) had the
  same executable behaviour as the current build. It was replaced only to
  correct two internal docstrings/comments that described SSRF rules as
  re-applied at fetch time; they are enforced when the URL list is frozen.
- `0x37Df9FD7167bDfAa357eDD3d493C1e8Bca5245a5` (tx
  `0xaad69a2b4b54e9fc8b6400476555128dc3478a700c2caa95d063c000886c458e`) called
  `web.render(mode="text")` and treated any successful return as HTTP 200.

The full reasons are in `deploy/deployments.json`, which is the only place the
live address lives.

## Studio Dev determinism note

Studio Dev's nondeterministic model intermittently returns malformed JSON, so
`exec_prompt(..., response_format="json")` yields output that `_safe_json`
cannot parse; the round then fails closed to `INCONCLUSIVE`, records the
attempt, and leaves the evaluation `PENDING`. This is a property of the preview
network, not of the contract — and it is the path the fail-closed design covers:
a round the model cannot answer cleanly never becomes a status. The remedy is to
call `evaluate` again; only a round that reaches agreement on a clean record
changes state.

Studio Dev is a preview network whose state resets. If the schema stops
resolving, treat BEACON as undeployed until it is redeployed — the interface
does this on its own.

## Toolchain

- Python 3.12.10, pytest 9.1.1, genvm-linter 0.11.1rc2
- genlayer-py 0.19.0rc2, genlayer-test 0.30.0rc2
- genlayer-js 2.0.0-rc.1, Node v22.16.0
- Deploy signer: unlocked local keystore (address only, never printed)
