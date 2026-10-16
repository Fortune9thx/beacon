# Steward

Who holds what, and what they can and cannot do. BEACON has no admin surface;
the steward's powers are bounded to the deploy itself.

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
  policy hash, so it cannot be changed after the fact without changing the hash.
- Evaluation fees credited on a converged status accumulate in `claimable` and
  are withdrawn only by `claim_fees`, called by the treasury itself.

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
  cap or sat 24h, anyone may trigger the refund — but it always goes to the
  recorded requester.

## Key handling

- The deployment key is a local keystore outside the repository. It is never
  printed, committed, or pasted into any file. See
  `~/.genlayer/keystores/`; `genlayer account` reports the address only.
- Studio Dev is a preview network that resets. When it does, the contract must
  be redeployed and `deploy/deployments.json` and the frontend's
  `VITE_CONTRACT_ADDRESS` updated together. The interface reports `no-code` on
  its own until that happens.

## What the steward does not control

The steward cannot make an evaluation COMPLIANT or NON_COMPLIANT. Only the
validators, running the equivalence principle against the pinned evidence, can
produce a status — and the fail-closed rules apply to the steward's requests
exactly as to anyone else's.
