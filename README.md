# BEACON

A frozen-policy status oracle on GenLayer.

A sponsor freezes a natural-language policy, the evidence hosts it may be judged
against, and an optional evaluation fee. Any agent then requests an evaluation,
which pins the exact evidence URLs for that request. Under the Equivalence
Principle, every validator independently re-fetches those URLs, applies the same
deterministic SSRF and length rules, fingerprints the full content of each
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

- **Unreadable evidence is never compliant.** If any pinned URL cannot be read,
  the round returns INCONCLUSIVE and the model is not consulted at all. A fetch
  failure is structurally incapable of producing a status.
- **A status without evidence is never compliant.** If the model returns
  COMPLIANT but cites no source, it is downgraded to INCONCLUSIVE.
- **Agreement is on facts, not prose.** Validators must agree on the discrete
  status, the sorted source and clause sets, and the sha256 of every full
  document — never on the wording of a summary.
- **No consensus means no status.** A round that cannot reach agreement writes
  nothing and records INCONCLUSIVE.

## Layout

```
contracts/
  Beacon.py              the contract
  beaconlib/             pure logic, inlined into the deployable
    ssrf.py              URL normalization + host allow-list
    canonicalize.py      policy/evidence canonicalization + digests
    judgment.py          the 3-status taxonomy + comparison record
  build_bundle.py        produces contracts/build/Beacon.bundled.py
  build/Beacon.bundled.py  the deployable (Depends line is byte one)
tests/                   in-process fake GenVM; no network
docs/                    architecture, audit, steward, deploy
frontend/                Vite + React + Tailwind, dark
deploy/deployments.json  the confirmed deployment record
```

## Develop

```bash
python -m pytest                       # contract + library tests
python contracts/build_bundle.py       # regenerate the deployable
genvm-lint lint contracts/build/Beacon.bundled.py
ruff check .

cd frontend
npm install
npm run typecheck && npm run build
```

See [docs/DEPLOY.md](docs/DEPLOY.md) to deploy, and [STATUS.md](STATUS.md) for
what is true right now.

## Network

Studio Dev only — chain id `61997`,
RPC `https://studio-dev.genlayer.com/api`,
explorer `https://explorer-studio-dev.genlayer.com`. BEACON refuses to write to
any other chain.

## License

MIT — see [LICENSE](LICENSE).
