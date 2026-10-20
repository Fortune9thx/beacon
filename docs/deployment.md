# Deployment

Studio Dev only — chain id `61997`, RPC `https://studio-dev.genlayer.com/api`.
`deploy/deployments.json` is the single source of truth for the live address;
never hardcode one elsewhere.

## 0. Reality checks

- **The `genlayer` CLI has no 61997 preset.** Its `studionet` preset is 61999,
  one digit away. Every command passes `--rpc https://studio-dev.genlayer.com/api`
  explicitly. `genlayer-js`'s `studioDevnet` *is* 61997 and the deploy/verify
  scripts use it.
- **Liveness is `gen_getContractSchema`.** `eth_getCode` returns `0x` for a live
  GenLayer contract, so it is never used as a liveness probe.
- **Fees are a complete object.** A zero or partial distribution is rejected
  client-side with `FeeValueMustBeNonZero(1)`, which reads like an on-chain
  revert. The scripts pass the proven complete distribution (distribution +
  feeValue). The frontend asks `estimateTransactionFeesForWrite` for the exact
  call and falls back to the same proven object.
- **The constructor address is bare and unquoted.** `deploy.mjs` spawns the
  CLI's JS entry with an argv array (no shell); `'"0xADDR"'` embeds literal quote
  characters that `Address()` rejects.

## 1. Build the deployable

```bash
python contracts/build_bundle.py
# wrote contracts/build/Beacon.bundled.py
```

The first line must be the `Depends` pin and nothing may precede it.
`tests/test_bundle.py` enforces that, LF endings, one contract class, no dropped
imports, and reproducibility. `contracts/build/Beacon.bundled.py` is generated —
never hand-edit it.

## 2. Lint

```bash
genvm-lint lint contracts/build/Beacon.bundled.py
```

`lint` runs the AST safety checks and needs no SDK download, so it is the CI
gate. `genvm-lint check` also validates the schema against the pinned runner
tarball; it is advisory because that tarball is not always fetchable.

## 3. Probe before spending

```bash
npm install                 # once, at the repository root
node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py
```

This is free: `getContractSchemaForCode` resolves the runner/`Depends` hash
without a transaction. If it fails, a real deploy would fail too.

## 4. Deploy

```bash
node deploy/deploy.mjs
```

Real and fee-bearing. It deploys with the proven fee distribution, records the
address, deploy tx, bundle bytes and sha256 in `deploy/deployments.json`, and
appends the previous address to `superseded` with a reason. Set
`SUPERSEDE_REASON` to make that reason specific.

If a shell is unavoidable, the equivalent CLI call is:

```bash
genlayer deploy \
  --contract contracts/build/Beacon.bundled.py \
  --rpc https://studio-dev.genlayer.com/api \
  --args 0xTREASURY
```

On Windows PowerShell the `.ps1` shims are blocked; call `genlayer.cmd`.

## 5. Verify on chain

```bash
node deploy/verify.mjs
```

Free. It checks the schema (11 methods: 6 view, 5 write), `get_config`
(`max_attempts=5`, `stale_timeout_seconds=86400`, `max_evidence_urls=5`),
owner/treasury, `get_policy_ids`/`get_board` shape, and that the recorded bundle
digest still matches the committed artifact. Any mismatch exits 1.

```bash
node deploy/smoke.mjs
```

A bounded live write: `cancel_stale` on an unknown id must be ACCEPTED with
leader execution `FINISHED_WITH_ERROR`. It attaches no value and changes no
state, but it does spend the ordinary transaction fee deposit.

## 6. Point the interface at it

Set `VITE_CONTRACT_ADDRESS` in the Vercel project (production and preview), then
redeploy **with the build cache disabled**. `VITE_*` is inlined at build time, so
changing the env var alone does nothing. Confirm the new address is present in
the served JavaScript before believing the app.

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Redeploying after a Studio Dev reset

Studio Dev state resets. When `getContractSchema` stops resolving, the contract
is gone. Redeploy (steps 1–5), then update `VITE_CONTRACT_ADDRESS` and redeploy
the frontend with the cache disabled. The interface reports `no-code` on its own
until then.

## Superseded addresses

`deploy/deployments.json` keeps every previous address with the reason it was
replaced. An address is recorded as live only after `getContractSchema` and
`get_config` confirm it. Do not delete the ledger: it is how a reviewer tells a
reset apart from an unreported code change.
