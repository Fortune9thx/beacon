/** The layout's recurring pieces, built once. */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { EXPLORER, explorerAddress } from "../lib/config";
import type { EvaluationStatus, Status } from "../lib/types";

/* --- page canvas -------------------------------------------------------- */

export function Blobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-24 h-[560px] w-[560px] rounded-full bg-brand/25 blur-[130px]" />
      <div className="absolute -right-40 top-[26%] h-[520px] w-[520px] animate-float rounded-full bg-magenta/20 blur-[130px]" />
      <div className="absolute bottom-0 left-1/4 h-[440px] w-[440px] rounded-full bg-ember/10 blur-[130px]" />
    </div>
  );
}

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-6xl px-5 ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/* --- marks -------------------------------------------------------------- */

/** BEACON's mark: a lamp throwing signals — a status announced, not judged by us. */
export function Logo({ className = "h-7 w-7 text-brand" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="24" r="2.6" fill="currentColor" />
      <path
        d="M10.5 19.5a7.8 7.8 0 0 1 11 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".85"
      />
      <path
        d="M6.6 15.2a13.3 13.3 0 0 1 18.8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".55"
      />
      <path
        d="M2.9 11a18.6 18.6 0 0 1 26.2 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".28"
      />
    </svg>
  );
}

export function Seal({ size = 116 }: { size?: number }) {
  const text = "BEACON · INDEPENDENTLY JUDGED · STUDIO DEV 61997 · ";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-spinslow">
        <defs>
          <path id="seal-arc" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
        </defs>
        <text className="fill-mute" style={{ fontSize: 6.2, letterSpacing: 1.0, fontWeight: 700 }}>
          <textPath href="#seal-arc">{text}</textPath>
        </text>
      </svg>
      <div className="absolute inset-0 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur" />
      <Logo className="h-7 w-7 text-brand-deep" />
    </div>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <Logo className="h-7 w-7 text-brand-deep" />
      <span className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">
        BEACON
      </span>
    </Link>
  );
}

/** A rotated-ellipse field: the reference's abstract accent panel. */
export function Spiral({ className = "h-full w-full" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <linearGradient id="spiralStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="55%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#ff4d5e" />
        </linearGradient>
      </defs>
      {Array.from({ length: 16 }).map((_, i) => (
        <ellipse
          key={i}
          cx="100"
          cy="100"
          rx="78"
          ry={26 - i * 0.4}
          fill="none"
          stroke="url(#spiralStroke)"
          strokeWidth="0.7"
          opacity={0.12 + i * 0.045}
          transform={`rotate(${i * 11.25} 100 100)`}
        />
      ))}
    </svg>
  );
}

/* --- pills -------------------------------------------------------------- */

const EVAL_STATUS_STYLE: Record<EvaluationStatus, string> = {
  PENDING: "bg-brand/15 text-brand-deep ring-brand/30",
  COMPLIANT: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  NON_COMPLIANT: "bg-ember/15 text-ember ring-ember/30",
  CANCELLED: "bg-white/5 text-mute ring-white/15",
};

export function StatusPill({ status }: { status: EvaluationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1 ring-inset ${
        EVAL_STATUS_STYLE[status] ?? EVAL_STATUS_STYLE.PENDING
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const OUTCOME_STYLE: Record<Status, string> = {
  COMPLIANT: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  NON_COMPLIANT: "bg-ember/15 text-ember ring-ember/30",
  INCONCLUSIVE: "bg-slate-400/10 text-slate-300 ring-slate-300/20",
};

export function OutcomePill({ status }: { status: Status | "" }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-pill bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-mute ring-1 ring-inset ring-white/15">
        not yet judged
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ring-1 ring-inset ${
        OUTCOME_STYLE[status] ?? OUTCOME_STYLE.INCONCLUSIVE
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* --- small building blocks --------------------------------------------- */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="break-words text-sm text-ink">{children}</div>
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-lg bg-black/40 px-2 py-0.5 text-[12px] font-medium text-brand-deep ring-1 ring-inset ring-white/10">
      {children}
    </code>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-chip bg-brand/15">
        <Logo className="h-6 w-6 text-brand-deep" />
      </div>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-md text-sm text-mute">{hint}</p>}
    </div>
  );
}

export function Spinner({ label = "Reading the chain…" }: { label?: string }) {
  return (
    <div className="card flex items-center justify-center gap-3 p-10 text-sm text-mute">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-brand-deep" />
      {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return (
    <div className="card border border-ember/25 p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ember">
        Could not read the chain
      </p>
      <p className="mt-2 break-words text-sm text-mute">{error}</p>
    </div>
  );
}

export function CtaBand({ title, action, to }: { title: string; action: string; to: string }) {
  return (
    <div className="relative overflow-hidden rounded-card shadow-lift">
      <div className="absolute inset-0 bg-gradient-to-r from-brand via-magenta to-ember" />
      <div className="relative flex flex-col items-start gap-6 px-8 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p className="max-w-md text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
          {title}
        </p>
        <Link to={to} className="btn-white shrink-0">
          {action}
        </Link>
      </div>
    </div>
  );
}

export function HashLink({ value, label }: { value: string; label?: string }) {
  if (!value) return <span className="text-mute">—</span>;
  return (
    <a
      href={`${EXPLORER}/tx/${value}`}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-brand-deep underline decoration-brand/30 underline-offset-2 hover:decoration-brand-deep"
    >
      {label ?? value}
    </a>
  );
}

export function AddressLink({ value, label }: { value: string; label?: string }) {
  if (!value) return <span className="text-mute">—</span>;
  return (
    <a
      href={explorerAddress(value)}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-brand-deep underline decoration-brand/30 underline-offset-2 hover:decoration-brand-deep"
    >
      {label ?? value}
    </a>
  );
}
