# Steward

How to operate BEACON without corrupting it or losing funds.

## Read this first

Read in this order, and read the file before the summary:

1. `contracts/Beacon.py` — **`_judge`** is the whole product. It is the only
   nondet path: one `strict_eq`, every fetch and the single prompt inside it.
   Then read the five writes; `claim_fees` is the only outbound transfer.
2. `contracts/beaconlib/judgment.py` — the fail-closed rules. Unreadable or
   non-200 evidence can only be INCONCLUSIVE, and the model is not consulted.
   A COMPLIANT with no cited source is downgraded.
3. `contracts/beaconlib/ssrf.py` — the host allow-list and the refusal of IP
   literals, credentials, non-default ports and internal names.
4. `tests/test_state_machine.py` — the money and state paths, including the
   attempt cap, the refund, and the treasury-only pull.
5. `docs/audit.md` — the findings, the sibling-build cross-check, and the
   residual limitations. `docs/STATUS.md` — what is live and what is not.

Why this order: the contract's safety is concentrated in one closure and three
pure modules. Reading `_judge` first makes every later test legible.

## Run it yourself

```bash
python contracts/build_bundle.py
genvm-lint lint contracts/build/Beacon.bundled.py
python -m pytest
ruff check .
npm install                       # once, for the deploy scripts
node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py   # free
node deploy/verify.mjs                                           # free
node deploy/smoke.mjs                                            # bounded refusal
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

`verify.mjs` reads `deploy/deployments.json` and fails closed on any mismatch,
including the bundle digest. `smoke.mjs` attaches no value but does spend the
ordinary transaction fee deposit.

## Ground rules

- `contracts/build/Beacon.bundled.py` is **generated**. Never hand-edit it. Edit
  `contracts/Beacon.py` or `contracts/beaconlib/*.py`, then run
  `python contracts/build_bundle.py`.
- `deploy/deployments.json` is the **single source of truth** for the live
  address. It also keeps every superseded address with the reason it was
  replaced.
- The policy text, evidence hosts, fee and treasury are **frozen at creation**;
  the treasury is fixed at deploy. Changing either means a new deployment or a
  new policy — never an edit.

## Redeploy after a source change

```bash
python contracts/build_bundle.py
genvm-lint lint contracts/build/Beacon.bundled.py
python -m pytest
node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py
SUPERSEDE_REASON="why this build replaces the last one" node deploy/deploy.mjs
node deploy/verify.mjs
```

`deploy.mjs` drives the CLI's own JS entry with an argv array (no shell), so the
bare treasury address arrives unquoted and the complete fee distribution arrives
as one JSON argument. A zero/partial distribution is rejected client-side with
`FeeValueMustBeNonZero(1)` **before broadcast**, though the message reads like an
on-chain revert. Then update `VITE_CONTRACT_ADDRESS` and redeploy the frontend
with the build cache disabled — `VITE_*` is inlined at build time.

## The deployer

- Becomes `owner` (recorded, not otherwise used) and `treasury` (unless a
  different treasury is passed to the constructor) at deploy.
- Is the only address that can ever call `claim_fees`, because the treasury is
  fixed at deploy and `claim_fees` compares the caller against it.
- Cannot edit a policy, change a fee, alter a status, cancel a live evaluation,
  or move a fee anywhere but the treasury.

## The treasury

- `treasury` is set once, in the constructor: the address passed in, or the
  deployer if none is passed. It is stored on the contract and folded into every
  policy hash.
- Evaluation fees credited on a converged status accumulate in `claimable` and
  are withdrawn only by `claim_fees`, called by the treasury itself. The balance
  is zeroed before the transfer.

## The sponsor

- Any address may `create_policy`. The sender is recorded as `sponsor`.
- A policy is immutable: `policy_id` is unique, and the text, evidence hosts,
  fee and treasury are hashed into `policy_hash` at creation.

## The requester

- Any address may `request_evaluation`, attaching exactly the policy fee.
- The requester is recorded and is the only address that can receive a
  `cancel_stale` refund.

## Anyone

- `evaluate` is permissionless: the requester has the incentive, but anyone may
  push a round.
- `cancel_stale` is permissionless: once an evaluation has burned its attempt
  cap (5) or sat 24h, anyone may trigger the refund — but it always goes to the
  recorded requester.

## If the app says `no-code`

Studio Dev can reset. `gen_getContractSchema` returning `-32001` means the
contract is gone. Redeploy, update `deploy/deployments.json` and
`VITE_CONTRACT_ADDRESS`, and redeploy the frontend with the cache disabled. The
interface reports `no-code` on its own; do not "fix" it by pointing at a new
address in code.

## Key handling

- The deployment key is a local keystore outside the repository. It is never
  printed, committed, or pasted into any file. See `~/.genlayer/keystores/`;
  `genlayer account` reports the address only.

## Commit rules

- Author is **`Fortunex9 <fortuneemx@gmail.com>`**, sole-authored.
- No co-author trailer, no AI attribution, no session links — not in commits,
  not in PR bodies, not in docs, not in code comments.

## What the steward does not control

The steward cannot make an evaluation COMPLIANT or NON_COMPLIANT. Only the
validators, running the equivalence principle against the pinned evidence, can
produce a status — and the fail-closed rules apply to the steward's requests
exactly as to anyone else's.
