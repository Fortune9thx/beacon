# Deploy

Studio Dev only — chain id `61997`, RPC `https://studio-dev.genlayer.com/api`.

## 1. Build the deployable

```bash
python contracts/build_bundle.py
# wrote contracts/build/Beacon.bundled.py
```

The first line of the bundle must be the `Depends` pin and nothing may precede
it. `tests/test_bundle.py` enforces this, along with a size ceiling and
reproducibility.

## 2. Lint the deployable

```bash
genvm-lint lint contracts/build/Beacon.bundled.py
```

`lint` runs the AST safety checks and needs no SDK download, so it is the CI
gate. `genvm-lint check` additionally validates the schema against the pinned
runner tarball; it is advisory because the tarball is not always fetchable.

## 3. Deploy

```bash
genlayer network              # must report studio-dev / 61997
genlayer deploy \
  --contract contracts/build/Beacon.bundled.py \
  --args "<treasury-address-or-empty>"
```

On Windows PowerShell the `.ps1` shims are blocked by the execution policy, so
call `genlayer.cmd` instead of `genlayer`.

Record the returned address and deploy transaction in `deploy/deployments.json`,
along with the bundle's `sha256` and byte count.

## 4. Verify on chain

```bash
genlayer call <address> get_config
genlayer call <address> get_policy_ids
```

`get_config` must return `max_attempts=5`, `stale_timeout_seconds=86400`,
`max_evidence_urls=5`, and the owner/treasury you expect.
`gen_getContractSchema` must list the six views and the five writes.

## 5. Point the interface at it

```bash
cd frontend
cp .env.example .env
# set VITE_CONTRACT_ADDRESS to the deployed address
npm run build
```

The interface probes liveness with `gen_getContractSchema`, not `eth_getCode`,
because `eth_getCode` reports `0x` for a live GenLayer contract.

## 6. Publish (Vercel)

```bash
cd frontend
vercel --prod
```

Set `VITE_CONTRACT_ADDRESS` (and leave the other `VITE_*` defaults) in the
Vercel project's environment, then redeploy so the value is baked into the
bundle.

## Redeploying after a Studio Dev reset

Studio Dev state resets. When the schema stops resolving, redeploy (steps 1–4)
and update `deploy/deployments.json` and `VITE_CONTRACT_ADDRESS` together. The
interface self-reports `no-code` until then.
