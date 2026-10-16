import { Link, useParams } from "react-router-dom";

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
import { getConfig, getEvaluation } from "../lib/chain";
import { fromNow, gen, hostOf, shortHash, until } from "../lib/format";
import { usePoll } from "../lib/useAsync";

export default function Evaluate() {
  const { id = "" } = useParams();
  const { health } = useHealth();
  const live = health.state === "live";
  const tx = useTx();

  const ev = usePoll(() => getEvaluation(id), 12_000, [id]);
  const config = usePoll(() => getConfig(), 60_000, []);

  const maxAttempts = config.data?.max_attempts ?? 5;
  const staleWindow = config.data?.stale_timeout_seconds ?? 86400;

  const e = ev.data;
  const pending = e?.status === "PENDING";
  const canEvaluate = live && !tx.busy && !!e && pending && e.attempts < maxAttempts;
  const staleDeadline = e ? e.created_at + staleWindow : 0;
  const cancelable =
    live && !tx.busy && !!e && pending && (e.attempts >= maxAttempts || Date.now() / 1000 >= staleDeadline);

  const runEvaluate = async () => {
    if (!e) return;
    const outcome = await tx.run("evaluate", [e.evaluation_id]);
    if (outcome?.ok) ev.reload();
  };

  const cancel = async () => {
    if (!e) return;
    const outcome = await tx.run("cancel_stale", [e.evaluation_id]);
    if (outcome?.ok) ev.reload();
  };

  if (health.state === "undeployed" || health.state === "no-code") {
    return (
      <Section className="py-12">
        <Empty
          title="Nothing is live yet"
          hint="No contract is deployed or configured on Studio Dev, so this evaluation cannot be read."
        />
      </Section>
    );
  }

  return (
    <Section className="py-12">
      <Link
        to="/app/activity"
        className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mute hover:text-ink"
      >
        ← Activity
      </Link>

      {ev.loading && !e ? (
        <div className="mt-8">
          <Spinner label="Reading the evaluation…" />
        </div>
      ) : ev.error && !e ? (
        <div className="mt-8">
          <ErrorNote error={ev.error} />
        </div>
      ) : !e ? (
        <div className="mt-8">
          <Empty
            title="No such evaluation"
            hint={`Nothing is stored under evaluation id "${id}".`}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <h1 className="h-display text-[34px]">{e.evaluation_id}</h1>
            <StatusPill status={e.status} />
            <OutcomePill status={e.last_status} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              {/* actions */}
              {pending && (
                <div className="card p-7">
                  <p className="eyebrow">Judgment</p>
                  <p className="mt-2 text-sm text-mute">
                    Each round runs the equivalence principle: every validator re-fetches
                    the pinned URLs and re-derives the status independently. A round that
                    converges on COMPLIANT or NON_COMPLIANT is terminal; an INCONCLUSIVE
                    round records the attempt and leaves the request open.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button className="btn-primary" onClick={runEvaluate} disabled={!canEvaluate}>
                      {tx.busy ? "Working…" : "Run a judgment round"}
                    </button>
                    {cancelable && (
                      <button className="btn-ember" onClick={cancel} disabled={!cancelable}>
                        Cancel stale · refund {gen(e.fee)}
                      </button>
                    )}
                    {e.attempts >= maxAttempts && (
                      <span className="text-[12px] text-mute">
                        Attempt cap reached — the fee is refundable.
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <TxStatus hash={tx.hash} outcome={tx.outcome} error={tx.error} />
                  </div>
                </div>
              )}

              {/* evidence */}
              <div className="card p-7">
                <p className="eyebrow">Pinned evidence</p>
                <p className="mt-2 text-sm text-mute">
                  Frozen at request time. Every validator fetches exactly these URLs.
                </p>
                <ul className="mt-4 space-y-3">
                  {e.evidence_urls.map((u, i) => {
                    const fp = e.fingerprints.find((f) => f[0] === i);
                    const supported = e.supporting_sources.includes(i);
                    return (
                      <li
                        key={u}
                        className="rounded-chip border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex flex-col gap-1">
                            <span className="font-mono text-[12px] text-ink">{hostOf(u)}</span>
                            <a
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-[12px] text-brand-deep underline decoration-brand/30 underline-offset-2"
                            >
                              {u}
                            </a>
                          </span>
                          {supported && (
                            <span className="shrink-0 rounded-pill bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                              cited
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[11px] text-mute">
                          {fp ? <>sha256 <Mono>{shortHash(fp[1], 10)}</Mono></> : "no fingerprint recorded"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="glass space-y-5 p-6">
                <Field label="Requested by">
                  <AddressLink value={e.requester} label={shortHash(e.requester)} />
                </Field>
                <Field label="Policy">
                  <Link
                    to={`/app/p/${encodeURIComponent(e.policy_id)}`}
                    className="font-medium text-brand-deep underline decoration-brand/30 underline-offset-2"
                  >
                    {e.policy_id}
                  </Link>
                </Field>
                <Field label="Fee">{gen(e.fee)}</Field>
                <Field label="Attempts">
                  {e.attempts} / {maxAttempts}
                </Field>
                <Field label="Requested">{fromNow(e.created_at)}</Field>
                {e.evaluated_at > 0 && (
                  <Field label="Last judged">{fromNow(e.evaluated_at)}</Field>
                )}
                {pending && e.attempts < maxAttempts && (
                  <Field label="Stale refund in">{until(staleDeadline)}</Field>
                )}
                {e.code && (
                  <Field label="Code">
                    <Mono>{e.code}</Mono>
                  </Field>
                )}
                <Field label="Policy hash at request">
                  <Mono>{shortHash(e.policy_hash, 12)}</Mono>
                </Field>
              </div>

              {e.clause_ids.length > 0 && (
                <div className="glass p-6">
                  <p className="eyebrow">Cited clauses</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.clause_ids.map((c) => (
                      <Mono key={c}>{c}</Mono>
                    ))}
                  </div>
                </div>
              )}

              {e.status === "CANCELLED" && (
                <div className="glass p-6 text-sm text-mute">
                  This evaluation never converged and was cancelled. The fee was refunded
                  to the requester in full; no status was ever published.
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </Section>
  );
}
