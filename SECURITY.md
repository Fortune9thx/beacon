# Security

## What BEACON assumes

- Validators re-execute the equivalence principle honestly; BEACON's guarantees
  are about what the *contract* does with their answers, not about the network.
- The evidence hosts a sponsor allows are ones the sponsor trusts to serve the
  document they expect. BEACON confines fetches to those hosts but does not
  vouch for their content.
- A downstream reader checks the record (policy hash, fingerprints, timestamps)
  rather than trusting the interface's rendering of it.

## Invariants

1. **No status without consensus.** A round that cannot agree writes nothing.
2. **No COMPLIANT/NON_COMPLIANT without readable evidence.** Unreadable evidence
   short-circuits to INCONCLUSIVE before the model runs.
3. **No COMPLIANT without a cited source.** A source-less COMPLIANT is
   downgraded.
4. **Value is conserved.** The contract accepts exactly the policy fee per
   request; a fee is either routed to the treasury (on convergence) or refunded
   in full (on cancel), never both, never neither.
5. **Refunds cannot be redirected.** `cancel_stale` pays only the recorded
   requester; `claim_fees` pays only the treasury, and zeroes the balance before
   transferring.
6. **Evidence is confined.** Only public https URLs on the default port, within
   the sponsor's host allow-list, and bounded in count and length.
7. **There is no admin surface.** No owner-only switch can alter a status, a
   policy, or a fee.

## Reporting

This is a portfolio artifact on a preview network and holds no production
value. If you nonetheless find a defect — particularly one that lets an
evaluation reach COMPLIANT without readable, cited evidence, or that lets value
move to an unintended address — open an issue on the repository with a minimal
reproduction.
