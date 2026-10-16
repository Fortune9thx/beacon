import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useHealth } from "../components/Chrome";
import { TxStatus, useTx } from "../components/TxPanel";
import { Eyebrow, Section } from "../components/ui";
import { toWei } from "../lib/format";

function splitPatterns(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function NewPolicy() {
  const nav = useNavigate();
  const { health } = useHealth();
  const tx = useTx();

  const [policyId, setPolicyId] = useState("");
  const [policyText, setPolicyText] = useState("");
  const [patterns, setPatterns] = useState("*.statuspage.io");
  const [fee, setFee] = useState("0");

  const live = health.state === "live";
  const patternList = splitPatterns(patterns);
  const canSubmit =
    live && !tx.busy && policyId.trim() && policyText.trim() && patternList.length > 0;

  const submit = async () => {
    const outcome = await tx.run("create_policy", [
      policyId.trim(),
      policyText.trim(),
      patternList,
      toWei(fee),
    ]);
    if (outcome?.ok) nav(`/app/p/${policyId.trim().toLowerCase()}`);
  };

  return (
    <Section className="py-12">
      <Eyebrow>New policy</Eyebrow>
      <h1 className="h-display mt-3 text-[34px]">Freeze the rule</h1>
      <p className="mt-2 max-w-2xl text-sm text-mute">
        A policy is immutable once registered. The rule text is the only thing validators
        judge against, and the evidence hosts you name are enforced before any URL is
        fetched, so evidence can only come from pages you allow.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="card space-y-5 p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="label">Policy id</span>
              <input
                className="field"
                placeholder="uptime-sla"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
              />
            </label>
            <label>
              <span className="label">Evaluation fee (GEN, optional)</span>
              <input
                className="field"
                inputMode="decimal"
                placeholder="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="label">Policy — what must be true to be COMPLIANT</span>
            <textarea
              className="field min-h-[150px]"
              placeholder="COMPLIANT when the linked status page reports the API as fully operational for the stated period. NON_COMPLIANT when it reports a degraded or partial outage. Otherwise INCONCLUSIVE."
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="label">Allowed evidence hosts (one per line, or comma-separated)</span>
            <textarea
              className="field min-h-[84px]"
              placeholder={"*.statuspage.io\nstatus.example.com"}
              value={patterns}
              onChange={(e) => setPatterns(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button className="btn-primary" onClick={submit} disabled={!canSubmit}>
              {tx.busy ? "Submitting…" : "Freeze policy"}
            </button>
            {!live && <span className="text-[12px] text-mute">Contract is not live.</span>}
          </div>
          <TxStatus hash={tx.hash} outcome={tx.outcome} error={tx.error} />
        </div>

        <aside className="space-y-4">
          <div className="glass p-6">
            <p className="eyebrow">What the fields mean</p>
            <ul className="mt-3 space-y-2 text-sm text-mute">
              <li>
                The <strong className="text-ink">policy</strong> is the only text validators
                judge against. It is hashed and frozen at creation.
              </li>
              <li>
                The <strong className="text-ink">host allow-list</strong> is enforced by SSRF
                rules — https, default port, public domains only.
              </li>
              <li>
                A <strong className="text-ink">fee</strong> is held during an evaluation and
                routed to the treasury only when a status converges; otherwise it is refunded.
              </li>
              <li>Zero is a valid fee — a policy can be judged at no cost.</li>
            </ul>
          </div>
          <div className="glass p-6">
            <p className="eyebrow">Allowed hosts</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {patternList.length ? (
                patternList.map((p) => (
                  <code
                    key={p}
                    className="rounded-lg bg-black/40 px-2 py-1 text-[12px] ring-1 ring-inset ring-white/10"
                  >
                    {p}
                  </code>
                ))
              ) : (
                <span className="text-sm text-mute">none yet</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </Section>
  );
}
