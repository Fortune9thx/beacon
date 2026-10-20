# Working notes

Frozen-policy status oracle on GenLayer. Read this before changing anything.

## Commit rules â€” not negotiable

- Author is **`Fortunex9 <fortuneemx@gmail.com>`**, sole-authored.
- **No co-author trailer, no AI attribution, no session links** â€” not in commit
  messages, not in PR bodies, not in docs, not in code comments.

## Source of truth

- `contracts/Beacon.py` + `contracts/beaconlib/*` are the sources.
- `contracts/build/Beacon.bundled.py` is **generated** â€” never hand-edit it.
  Regenerate with `python contracts/build_bundle.py`.
- `deploy/deployments.json` is the **only** place the live address lives.
- The contract has exactly five writes and six views. There is no claim,
  appeal, dispute, payout, reimbursement or settlement surface, and adding one
  is a product violation, not a feature.

## Verify before believing anything

```bash
python contracts/build_bundle.py
genvm-lint lint contracts/build/Beacon.bundled.py
python -m pytest                                   # 105 pure/in-process tests
ruff check .
node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py
node deploy/verify.mjs                             # free, reads deployments.json
node deploy/smoke.mjs                              # bounded refusal (costs the tx fee deposit)
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

`node deploy/probe_schema.mjs` and `verify.mjs` need the root dependencies:
`npm install` once at the repository root.

## Traps that have already cost real time

1. **Never use `eth_getCode` as a liveness probe.** A healthy GenLayer IC
   returns `0x`. Use `gen_getContractSchema` (schema when live, `-32001` when
   absent).
2. **The `genlayer` CLI has no 61997 preset** (its `studionet` is 61999). Always
   pass `--rpc https://studio-dev.genlayer.com/api`. `genlayer-js`'s
   `studioDevnet` *is* 61997.
3. **Fees:** a zero/partial distribution fails client-side with
   `FeeValueMustBeNonZero(1)` (reads like a revert). The frontend asks
   `estimateTransactionFeesForWrite` for the exact call and falls back to the
   proven complete distribution; the deploy/smoke scripts pass that same proven
   distribution. Do not pass a bare `feeValue` or a partial distribution.
4. **Constructor address args must be bare and unquoted.** Drive the CLI's JS
   entry with an argv array (no shell) â€” see `deploy/deploy.mjs`.
5. **Unit tests need `-p no:gltest`** when `genlayer-test` is installed; its
   plugin validates `gltest.config.yaml` and blocks collection.
6. **`build/` output is generated and LF-only.** CI fails if the committed
   bundle differs from a fresh build. `.gitattributes` forces LF.
7. **`VITE_*` is inlined at build time.** Changing `VITE_CONTRACT_ADDRESS` on
   Vercel does nothing until a redeploy with the build cache disabled. Confirm
   the new address is in the served JS before believing the app.
8. **Fetch status is evidence.** A 404/500 page must never be read as evidence,
   however compliant its prose looks. `_judge` uses `gl.nondet.web.get` and
   normalizes on the explicit status; non-200 becomes INCONCLUSIVE.
9. **Addresses are stored lowercase.** Every credit, claim lookup and board
   record normalizes before use; a checksummed key would otherwise read zero and
   strand a fee.
10. **`gl.nondet.web.Response.body` is bytes.** `normalize_evidence` decodes
    bytes and marks non-200; do not feed the raw body to a str-only sanitizer.
11. **Sanitizers must attack delimiters, not words.** Remove fence/control
    sequences only; stripping words corrupts frozen policy text and its hash.

## Known limitations â€” state these, never paper over them

- **The full happy path is live for reads and pending evaluations, not for a
  converged COMPLIANT/NON_COMPLIANT or a nonzero payout.** See
  `docs/STATUS.md`; the test suite covers the converged paths.
- **There are no direct GenVM tests.** The pinned runner asset is not reliably
  fetchable, so the suite runs against the in-process fake runtime. The
  validator closure is exercised by running `strict_eq` twice; the real gate is
  the standard `gl.eq_principle.strict_eq` primitive.
- **The requester chooses the evidence**, within the sponsor's host allow-list.
  BEACON judges the pinned pages; it does not verify that they are the "true"
  version of a page, and it does not verify that the policy itself is good.
- **Studio Dev is a preview network that resets.** If the schema stops
  resolving, the contract is gone; redeploy and update `deployments.json` and
  `VITE_CONTRACT_ADDRESS` together.

## Where things are

```
contracts/   Beacon.py + beaconlib/ (pure logic) â€” sources of truth
contracts/build/  Beacon.bundled.py â€” generated, deployed, never hand-edited
tests/       in-process fake GenVM; 105 tests, no network
deploy/      deployments.json (live + superseded) Â· probe Â· verify Â· deploy Â· smoke
docs/        STATUS Â· SUBMISSION Â· STEWARD Â· architecture Â· audit Â· deployment
frontend/    Vite + React + TypeScript, fails closed when the contract is unreachable
```
