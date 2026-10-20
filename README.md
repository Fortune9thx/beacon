# BEACON

A frozen-policy status oracle on GenLayer.

A sponsor freezes a natural-language policy, the evidence hosts it may be judged
against, and an optional evaluation fee. Any agent then requests an evaluation,
which pins the exact evidence URLs for that request. Under the Equivalence
Principle, every validator independently re-fetches those URLs, applies the same
deterministic normalization and length rules, fingerprints the full content of each
document, and re-derives **one discrete status**:

```
COMPLIANT | NON_COMPLIANT | INCONCLUSIVE
```

There is no fourth outcome. There is no appeal, no dispute, and no payout. The
only value that ever moves is an optional evaluation fee, held while an
evaluation is pending and routed to the recorded treasury only when a COMPLIANT
or NON_COMPLIANT status converges. A request that never converges past its
attempt cap (or sits untouched for 24h) can be cancelled by anyone, refunding
the fee to the requester in full.

## Why it fails closed

- **Unreadable evidence is never compliant.** If any pinned URL cannot be read —
  including a non-200 response — the round returns INCONCLUSIVE and the model is
  not consulted at all. A fetch failure is structurally incapable of producing a
  status.
- **A status without evidence is never compliant.** If the model returns
  COMPLIANT but cites no source, it is downgraded to INCONCLUSIVE.
- **Agreement is on facts, not prose.** Validators must agree on the discrete
  status, the sorted source and clause sets, and the sha256 of every full
  document — never on the wording of a summary.
- **No agreement means no status.** A diverging round writes nothing: live it is
  `UNDETERMINED` and the evaluation is untouched. An agreed INCONCLUSIVE round
  records the attempt and stays pending.

## Live

- Contract: [`0x9479942AFE108A6fE3AA691224fAf21798f37185`](https://explorer-studio-dev.genlayer.com/address/0x9479942AFE108A6fE3AA691224fAf21798f37185)
  on GenLayer Studio Dev, chain 61997.
- App: https://beacon-six-zeta.vercel.app
- Deploy tx: `0x67933e326c6fa5cf514e7c88e885f61fe6285151ce6063de0559a82e019d4df7`
  (`ACCEPTED`).
- Live proof and limits: [docs/STATUS.md](docs/STATUS.md). A 404-evidence
  evaluation resolved `unreadable_evidence` without consulting the model, a
  retry converged `NON_COMPLIANT`, and one diverging round wrote nothing. A live
  `COMPLIANT` and a nonzero fee have **not** been driven.

## Layout

```
contracts/
  Beacon.py              the contract (one nondet path: _judge)
  beaconlib/             pure logic, inlined into the deployable
    ssrf.py              URL normalization + host allow-list
    canonicalize.py      policy/evidence canonicalization + digests
    judgment.py          the 3-status taxonomy + comparison record
  build_bundle.py        produces contracts/build/Beacon.bundled.py
  build/Beacon.bundled.py  the deployable (Depends line is byte one)
tests/                   in-process fake GenVM; 105 tests, no network
deploy/                  deployments.json (live + superseded) + probe/verify/deploy/smoke
docs/                    STATUS · SUBMISSION · STEWARD · architecture · audit · deployment
frontend/                Vite + React + Tailwind, dark
```

## Develop

```bash
python -m pytest                       # 105 contract + library tests
python contracts/build_bundle.py       # regenerate the deployable
genvm-lint lint contracts/build/Beacon.bundled.py
ruff check .

npm install                            # root deps for the deploy scripts
node deploy/probe_schema.mjs contracts/build/Beacon.bundled.py
node deploy/verify.mjs

cd frontend
npm install
npm run typecheck && npm run build
```

See [docs/deployment.md](docs/deployment.md) to deploy, and
[docs/STATUS.md](docs/STATUS.md) for what is true right now. The Portal packet
is [docs/SUBMISSION.md](docs/SUBMISSION.md).

## Network

Studio Dev only — chain id `61997`,
RPC `https://studio-dev.genlayer.com/api`,
explorer `https://explorer-studio-dev.genlayer.com`. BEACON refuses to write to
any other chain.

## License

MIT — see [LICENSE](LICENSE).
