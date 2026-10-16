import { Link } from "react-router-dom";

import { CtaBand, Eyebrow, Section, Seal, Spiral } from "../components/ui";

function Check({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-mute">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/20 text-brand-deep">
        <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden>
          <path
            d="M5 10.5l3 3 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {children}
    </li>
  );
}

const SERVICES = [
  {
    n: "/01",
    title: "Freeze the policy",
    to: "/app/new",
    body: "Write the rule in plain language and list the hosts its evidence may come from. The policy is stored immutably, hashed, and never edited.",
    points: ["Natural-language rule text", "Host allow-list per policy", "Optional evaluation fee"],
  },
  {
    n: "/02",
    title: "Freeze the evidence",
    to: "/app",
    body: "Any agent requests an evaluation. The exact evidence URLs are captured at that moment and thereafter re-fetched independently by every validator.",
    points: ["URLs locked at request time", "SSRF and length rules applied", "Full-content fingerprints"],
  },
  {
    n: "/03",
    title: "Read one status",
    to: "/app/activity",
    body: "Validators agree on exactly one discrete status — never prose. Downstream agents read the settled record and act on it. There is no appeal.",
    points: ["COMPLIANT / NON_COMPLIANT", "or INCONCLUSIVE", "Append-only, timestamped"],
  },
];

const STEPS = [
  {
    t: "Freeze",
    d: "A sponsor registers an immutable policy: rule text, evidence hosts, and an optional fee.",
  },
  {
    t: "Request",
    d: "A requester pins the exact evidence URLs and attaches the fee. Nothing else is trusted.",
  },
  {
    t: "Judge",
    d: "Each validator re-fetches the URLs, fingerprints the full documents, and re-derives the status.",
  },
  {
    t: "Settle",
    d: "Agreement on the discrete status is written and the fee routes to the treasury. No status, no payment.",
  },
];

const STATS = [
  { k: "3", v: "possible statuses, no prose" },
  { k: "0", v: "appeals, disputes or payouts" },
  { k: "5", v: "attempts before a fee is refunded" },
  { k: "24h", v: "stale window on a silent requester" },
];

const FAQ = [
  {
    q: "Is this a dispute product?",
    a: "No. BEACON issues a status, not a verdict against anyone. There is no claim, no appeal, and no reimbursement. It answers one question — does this evidence meet this written policy — and stops.",
  },
  {
    q: "How can I trust the status?",
    a: "Every validator independently re-fetches the evidence and re-derives the status, and agreement is checked on the discrete status, the sorted source and clause sets, and the sha256 of every full document — never on the wording of a summary.",
  },
  {
    q: "What if the evidence cannot be read?",
    a: "The result is INCONCLUSIVE, and the model is never consulted. A fetch failure is structurally incapable of producing COMPLIANT or NON_COMPLIANT, so unreadable evidence can only fail closed.",
  },
  {
    q: "Where does the fee go?",
    a: "Fees are held while an evaluation is pending and routed to the recorded treasury only when a COMPLIANT or NON_COMPLIANT status converges. If none ever does, a permissionless cancel refunds the fee to the requester in full.",
  },
];

export default function Home() {
  return (
    <div>
      {/* hero */}
      <Section className="grid items-center gap-12 py-20 md:grid-cols-[1.15fr_.85fr] md:py-28">
        <div>
          <Eyebrow>Frozen-policy status oracle</Eyebrow>
          <h1 className="h-display mt-5 text-[44px] sm:text-[58px]">
            Freeze a policy.
            <span className="block text-mute">
              Read one status, re-derived by every validator.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-mute">
            BEACON turns a written rule and a set of evidence sources into a single
            discrete status. Not a report, not a scorecard — one of three values, agreed
            by independent GenLayer validators.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className="btn-primary">
              Open the board
            </Link>
            <Link to="/app/new" className="btn-ghost">
              Create a policy
            </Link>
          </div>
        </div>
        <div className="relative flex justify-center md:justify-end">
          <Seal />
        </div>
      </Section>

      {/* status strip */}
      <Section className="pb-6">
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-white/10 bg-white/[0.03] px-6 py-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-mute">
            The only outcomes
          </span>
          <span className="rounded-pill bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            Compliant
          </span>
          <span className="rounded-pill bg-ember/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ember ring-1 ring-inset ring-ember/30">
            Non-compliant
          </span>
          <span className="rounded-pill bg-slate-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300 ring-1 ring-inset ring-slate-300/20">
            Inconclusive
          </span>
        </div>
      </Section>

      {/* services row */}
      <Section className="py-16">
        <div className="grid gap-8 lg:grid-cols-[.72fr_2fr]">
          <div className="relative overflow-hidden rounded-card border border-white/10 bg-panel">
            <div className="absolute inset-0 opacity-70">
              <Spiral />
            </div>
            <div className="relative flex h-full flex-col justify-between p-8">
              <Eyebrow>Our method</Eyebrow>
              <p className="mt-6 max-w-[16rem] text-[20px] font-semibold leading-snug text-ink">
                Three frozen things, and exactly one status.
              </p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.n} className="card flex flex-col p-7">
                <span className="num">{s.n}</span>
                <h3 className="mt-4 text-[19px] font-bold tracking-[-0.01em] text-ink">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-mute">{s.body}</p>
                <ul className="mt-5 space-y-2.5">
                  {s.points.map((p) => (
                    <Check key={p}>{p}</Check>
                  ))}
                </ul>
                <Link
                  to={s.to}
                  className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-deep hover:text-ink"
                >
                  Learn more
                  <span aria-hidden>↗</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* is / is not */}
      <Section className="py-10">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-card p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-brand to-magenta opacity-90" />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                What it is
              </p>
              <p className="mt-4 text-[22px] font-semibold leading-snug text-white">
                An oracle that reads a written policy against pinned evidence and returns
                one discrete status.
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-card p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-ember to-magenta opacity-80" />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                What it is not
              </p>
              <p className="mt-4 text-[22px] font-semibold leading-snug text-white">
                Not a claim, an appeal, a payout or a dispute. No status ever moves money
                to a third party.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* steps */}
      <Section className="py-16">
        <Eyebrow>One round</Eyebrow>
        <h2 className="h-display mt-3 max-w-2xl text-[30px] sm:text-[36px]">
          From freeze to status, every participant sees the same evidence.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.t} className="card p-7">
              <span className="num">/0{i + 1}</span>
              <h3 className="mt-4 text-[17px] font-bold text-ink">{s.t}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-mute">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* stats */}
      <Section className="py-6">
        <div className="grid gap-px overflow-hidden rounded-card border border-white/10 bg-white/10 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.v} className="bg-panel p-8">
              <p className="font-display text-[40px] font-bold leading-none text-ink">{s.k}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-mute">{s.v}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* faq */}
      <Section className="py-16">
        <div className="grid gap-10 md:grid-cols-[.7fr_1.3fr]">
          <div>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="h-display mt-3 text-[30px]">Read before you trust a status.</h2>
          </div>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="text-[16px] font-semibold text-ink">{f.q}</span>
                  <span className="text-brand-deep transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* cta */}
      <Section className="pb-4">
        <CtaBand
          title="Freeze a policy and let the validators publish the status."
          action="Create a policy"
          to="/app/new"
        />
      </Section>
    </div>
  );
}
