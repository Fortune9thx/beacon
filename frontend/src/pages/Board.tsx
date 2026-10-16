import { Link } from "react-router-dom";

import { useHealth } from "../components/Chrome";
import { Empty, ErrorNote, Eyebrow, Section, Spinner } from "../components/ui";
import { listPolicies } from "../lib/chain";
import { gen, shortHash } from "../lib/format";
import { useAsync } from "../lib/useAsync";

export default function Board() {
  const { health } = useHealth();
  const { data, error, loading } = useAsync(() => listPolicies(60), []);

  return (
    <Section className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Policy board</Eyebrow>
          <h1 className="h-display mt-3 text-[34px]">Frozen policies</h1>
          <p className="mt-3 max-w-xl text-sm text-mute">
            Each policy below is immutable: its rule text, evidence hosts and fee are
            fixed at creation. Open one to request an evaluation or read its statuses.
          </p>
        </div>
        <Link to="/app/new" className="btn-primary">
          Create a policy
        </Link>
      </div>

      <div className="mt-10">
        {health.state === "undeployed" || health.state === "no-code" ? (
          <Empty
            title="Nothing is live yet"
            hint="No contract is deployed or configured on Studio Dev, so there are no policies to show. This is stated plainly rather than filled with placeholders."
          />
        ) : loading ? (
          <Spinner />
        ) : error ? (
          <ErrorNote error={error} />
        ) : !data || data.length === 0 ? (
          <Empty
            title="No policies yet"
            hint="Be the first to freeze a policy. It takes a rule, a list of evidence hosts, and an optional fee."
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.map((p) => (
              <Link
                key={p.policy_id}
                to={`/app/p/${encodeURIComponent(p.policy_id)}`}
                className="card group flex flex-col p-7 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-[18px] font-bold text-ink">
                    {p.policy_id}
                  </span>
                  <span className="rounded-pill bg-brand/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-deep ring-1 ring-inset ring-brand/30">
                    {p.evidence_patterns.length} host
                    {p.evidence_patterns.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-mute">
                  {p.policy_text}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[12px] text-mute">
                  <span>fee {gen(p.fee_amount)}</span>
                  <span className="font-mono">{shortHash(p.policy_hash)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
