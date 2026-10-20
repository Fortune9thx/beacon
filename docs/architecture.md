# Architecture

BEACON is one contract and one non-deterministic path. Everything else is
deterministic, and the split is deliberate: the only thing that needs validators
is reading a web document and deciding whether it satisfies a written rule.

## The one non-deterministic path

`Beacon.evaluate` holds exactly one `gl.eq_principle.strict_eq` call. The
function it is handed — `judge` — performs every `gl.nondet.web.get` and the
single `gl.nondet.exec_prompt`. genvm-lint only follows `gl.nondet.*` calls made
directly inside the function passed to the equivalence principle, so `judge` is
defined inline rather than factored one hop away.

Inside `judge`, for each pinned URL:

1. `gl.nondet.web.get(url)` — fetch, independently, on the leader and on every
   validator. The response's `status` and `body` are read explicitly; the body
   may be `bytes`.
2. `normalize_evidence(url, status, body)` — pure. A non-200 response is marked
   unreadable. For a 200 response it strips HTML, applies the length rule, and
   takes a sha256 fingerprint of the **full** document (not the bounded excerpt).
3. If any document is unreadable, return INCONCLUSIVE at once. The model is not
   consulted.
4. Otherwise `gl.nondet.exec_prompt(prompt, response_format="json")` and
   `build_comparable(...)` — pure. It reduces the model output to the
   comparison record and enforces the fail-closed downgrade.

`strict_eq` re-runs `judge` on every validator and compares the returned
strings. Because each validator canonicalizes through the same pure function,
agreement is decided on:

```
status             COMPLIANT | NON_COMPLIANT | INCONCLUSIVE
supporting_sources sorted list of source indices the status cites
clause_ids         sorted list of policy clause ids cited
fingerprints       sorted [index, sha256(full document)] pairs
code               a stable reason code ("" on a clean status)
```

Nothing about the prose of the model's answer enters the comparison. If two runs
fetch different bytes, their fingerprints differ and `strict_eq` cannot agree.
On chain that surfaces as an `UNDETERMINED` transaction that writes nothing; the
contract's caught-exception path (`_FAIL_CLOSED`) records INCONCLUSIVE with code
`no_consensus` when a raised consensus call is part of an accepted write. A
technical failure never becomes a finding.

## Storage

State is JSON documents in `TreeMap`s, not nested dataclasses. Evaluations are
read and written whole, so a single document is the natural unit and a flat
storage surface is easier to audit than a graph of one.

```
policies      policy id -> policy JSON (immutable)
policy_ids    "all" -> JSON list of policy ids
evaluations   evaluation id -> evaluation JSON (append-only status)
board         "all" -> JSON list of evaluation ids (capped, newest kept)
claimable     address -> wei owed (fees awaiting claim)
```

Wei is serialized as a decimal **string**. `0.01 GEN` is `1e16` wei, above
JavaScript's `2**53` exact-integer range, so a JSON number would silently lose
precision on the way to any JS client.

## The three statuses

| Status         | Meaning                                                        |
| -------------- | ------------------------------------------------------------- |
| `COMPLIANT`    | The evidence satisfies the written policy, with cited sources. |
| `NON_COMPLIANT`| The evidence contradicts the written policy.                   |
| `INCONCLUSIVE` | The evidence could not be read, or could not be reduced to a clear answer. |

A `COMPLIANT` or `NON_COMPLIANT` round is terminal and routes the fee to the
treasury. An `INCONCLUSIVE` round records the attempt and leaves the evaluation
`PENDING`, retryable up to `MAX_ATTEMPTS` (5).

## Fee flow

```
create_policy      fee is a number in the policy record; no value moves
request_evaluation value must equal the policy fee, exactly, or it reverts
evaluate           on COMPLIANT / NON_COMPLIANT: credit the treasury
                   on INCONCLUSIVE:                  hold, stay PENDING
cancel_stale       attempts >= cap OR 24h elapsed: refund requester, in full
claim_fees         treasury-only pull of everything credited to it
```

`request_evaluation` rejects any attached value other than the exact fee, so no
value is ever stranded by an overpayment and the contract only holds what a
single evaluation disclosed. The refund on cancel is pushed only to the
evaluation's recorded `requester` — an unrelated caller may advance the refund
but can never redirect it. `claim_fees` zeroes the balance before transferring,
so a re-entrant or failing recipient cannot double-spend it.

## Determinism under review

`_now()` reads `gl.message.raw["datetime"]`, the timestamp every validator
re-executing the call sees identically. `gl.block` does not exist on this
runtime and `gl.vm.get_timestamp()` raises; the message field is the one that
works and the correct source on the merits.

The bundler inlines `beaconlib/` into the deployable between two markers. Two
SDK imports (`genlayer.storage.TreeMap`, `genlayer.types.*`) are anchored above
the opening marker, so an import that drifts inside the block cannot be silently
deleted from the deployable while local tests keep passing against the fake
runtime.
