import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useHealth } from "../components/Chrome";
import { TxStatus, useTx } from "../components/TxPanel";
import {
  AddressLink,
  Empty,
  ErrorNote,
  Field,
  Mono,
  OutcomePill,
  Section,
  Spinner,
  StatusPill,
} from "../components/ui";
import { evaluationsForPolicy, getConfig, getPolicy } from "../lib/chain";
import { fromNow, gen, shortHash } from "../lib/format";
import { useAsync } from "../lib/useAsync";

function splitUrls(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function PolicyDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { health } = useHealth();
  const live = health.state === "live";
  const tx = useTx();

  const policy = useAsync(() => getPolicy(id), [id]);
  const config = useAsync(() => getConfig(), []);
  const evals = useAsync(
    () => (live ? evaluationsForPolicy(id) : Promise.resolve([])),
    [id, live],
  );

  const [urls, setUrls] = useState("");

  const maxUrls = config.data?.max_evidence_urls ?? 5;
  const fee = policy.data ? BigInt(policy.data.fee_amount) : 0n;
  const urlList = splitUrls(urls);
  const canSubmit =
    live && !tx.busy && !!policy.data && urlList.length > 0 && urlList.length <= maxUrls;

  const submit = async () => {
    if (!policy.data) return;
    const outcome = await tx.run("request_evaluation", [policy.data.policy_id, urlList], fee);
    if (outcome?.ok) nav("/app/activity");
  };

  if (health.state === "undeployed" || health.state === "no-code") {
    return (
      <Section className="py-12">
        <Empty
          title="Nothing is live yet"
          hint="No contract is deployed or configured on Studio Dev, so this policy cannot be read."
        />
      </Section>
    );
  }

  return (
    <Section className="py-12">
      <Link to="/app" className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mute hover:text-ink">
        ← All policies
      </Link>

      {policy.loading ? (
        <div className="mt-8">
          <Spinner label="Reading the policy…" />
        </div>
      ) : policy.error ? (
        <div className="mt-8">
          <ErrorNote error={policy.error} />
        </div>
      ) : !policy.data ? (
        <div className="mt-8">
          <Empty title="No such policy" hint={`Nothing is stored under policy id "${id}".`} />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <h1 className="h-display text-[34px]">{policy.data.policy_id}</h1>
            <span className="rounded-pill bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute ring-1 ring-inset ring-white/15">
              fee {gen(policy.data.fee_amount)}
            </span>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              <div className="card p-7">
                <p className="eyebrow">Policy text</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {policy.data.policy_text}
                </p>
                <div className="mt-6 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
                  <Field label="Sponsor">
                    <AddressLink value={policy.data.sponsor} label={shortHash(policy.data.sponsor)} />
                  </Field>
                  <Field label="Treasury">
                    <AddressLink value={policy.data.treasury} label={shortHash(policy.data.treasury)} />
                  </Field>
                  <Field label="Policy hash">
                    <Mono>{shortHash(policy.data.policy_hash, 12)}</Mono>
                  </Field>
                  <Field label="Created">{fromNow(policy.data.created_at)}</Field>
                </div>
                <div className="mt-5">
                  <p className="label">Allowed evidence hosts</p>
                  <div className="flex flex-wrap gap-1.5">
                    {policy.data.evidence_patterns.map((p) => (
                      <Mono key={p}>{p}</Mono>
                    ))}
                  </div>
                </div>
              </div>

              {/* request evaluation */}
              <div className="card p-7">
                <p className="eyebrow">Request an evaluation</p>
                <p className="mt-2 text-sm text-mute">
                  Pin the exact evidence URLs for one evaluation. Attach exactly{" "}
                  <strong className="text-ink">{gen(policy.data.fee_amount)}</strong> — the
                  contract rejects any other value so nothing is ever stranded.
                </p>
                <label className="mt-5 block">
                  <span className="label">
                    Evidence URLs (one per line, up to {maxUrls})
                  </span>
                  <textarea
                    className="field min-h-[96px]"
                    placeholder="https://status.example.com/incidents/123"
                    value={urls}
                    onChange={(e) => setUrls(e.target.value)}
                  />
                </label>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button className="btn-primary" onClick={submit} disabled={!canSubmit}>
                    {tx.busy ? "Submitting…" : `Request · attach ${gen(fee)}`}
                  </button>
                  {urlList.length > maxUrls && (
                    <span className="text-[12px] text-ember">At most {maxUrls} URLs.</span>
                  )}
                  {!live && <span className="text-[12px] text-mute">Contract is not live.</span>}
                </div>
                <div className="mt-4">
                  <TxStatus hash={tx.hash} outcome={tx.outcome} error={tx.error} />
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="glass p-6">
                <p className="eyebrow">Evaluations</p>
                {evals.loading ? (
                  <p className="mt-3 text-sm text-mute">Reading…</p>
                ) : evals.error ? (
                  <p className="mt-3 break-words text-sm text-ember/90">{evals.error}</p>
                ) : !evals.data || evals.data.length === 0 ? (
                  <p className="mt-3 text-sm text-mute">None yet for this policy.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-white/10">
                    {evals.data.map((e) => (
                      <li key={e.evaluation_id}>
                        <Link
                          to={`/app/e/${encodeURIComponent(e.evaluation_id)}`}
                          className="flex items-center justify-between gap-3 py-3 hover:opacity-90"
                        >
                          <span className="flex flex-col gap-1">
                            <span className="font-mono text-[13px] text-ink">
                              {e.evaluation_id}
                            </span>
                            <span className="text-[11px] text-mute">
                              {e.attempts} attempt{e.attempts === 1 ? "" : "s"} ·{" "}
                              {fromNow(e.created_at)}
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-1">
                            <StatusPill status={e.status} />
                            <OutcomePill status={e.last_status} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </Section>
  );
}
