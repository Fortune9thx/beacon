import { Link } from "react-router-dom";

import { useHealth } from "../components/Chrome";
import { TxStatus, useTx } from "../components/TxPanel";
import {
  Empty,
  ErrorNote,
  Eyebrow,
  OutcomePill,
  Section,
  Spinner,
  StatusPill,
} from "../components/ui";
import { getBoard, getFeeClaimable } from "../lib/chain";
import { fromNow, gen, shortAddr } from "../lib/format";
import { usePoll } from "../lib/useAsync";

export default function Activity() {
  const { health, account } = useHealth();
  const live = health.state === "live";
  const tx = useTx();

  const board = usePoll(() => (live ? getBoard(50) : Promise.resolve([])), 15_000, [live]);
  const claimable = usePoll(
    () => (live && account ? getFeeClaimable(account) : Promise.resolve("0")),
    20_000,
    [live, account],
  );

  const owed = BigInt(claimable.data ?? "0");
  const canClaim = live && !tx.busy && !!account && owed > 0n;

  const claim = async () => {
    const outcome = await tx.run("claim_fees", []);
    if (outcome?.ok) {
      claimable.reload();
      board.reload();
    }
  };

  return (
    <Section className="py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Activity</Eyebrow>
          <h1 className="h-display mt-3 text-[34px]">Every evaluation, newest first</h1>
          <p className="mt-3 max-w-xl text-sm text-mute">
            The board reads straight from the contract. A pending evaluation can be judged
            by anyone; a settled one is terminal and never changes.
          </p>
        </div>
        <Link to="/app" className="btn-ghost">
          Policies
        </Link>
      </div>

      {account && (
        <div className="mt-8 card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="eyebrow">Evaluation fees</p>
            <p className="mt-1.5 text-sm text-mute">
              {shortAddr(account)} is owed{" "}
              <strong className="text-ink">{gen(owed)}</strong> in accrued fees.
            </p>
          </div>
          <button className="btn-primary" onClick={claim} disabled={!canClaim}>
            {tx.busy ? "Claiming…" : "Claim fees"}
          </button>
        </div>
      )}

      {account && (tx.hash || tx.error) && (
        <div className="mt-4">
          <TxStatus hash={tx.hash} outcome={tx.outcome} error={tx.error} />
        </div>
      )}

      <div className="mt-10">
        {health.state === "undeployed" || health.state === "no-code" ? (
          <Empty
            title="Nothing is live yet"
            hint="No contract is deployed or configured on Studio Dev, so there is no activity to show."
          />
        ) : board.loading && !board.data ? (
          <Spinner label="Reading the board…" />
        ) : board.error ? (
          <ErrorNote error={board.error} />
        ) : !board.data || board.data.length === 0 ? (
          <Empty
            title="No evaluations yet"
            hint="Open a policy and request an evaluation to see it appear here."
          />
        ) : (
          <div className="card divide-y divide-white/10 overflow-hidden">
            <div className="hidden grid-cols-[1.1fr_1.2fr_auto_auto_auto] gap-4 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-mute md:grid">
              <span>Evaluation</span>
              <span>Policy</span>
              <span>State</span>
              <span>Last status</span>
              <span className="text-right">Age</span>
            </div>
            {board.data.map((b) => (
              <Link
                key={b.evaluation_id}
                to={`/app/e/${encodeURIComponent(b.evaluation_id)}`}
                className="grid grid-cols-2 items-center gap-4 px-6 py-4 transition hover:bg-white/[0.04] md:grid-cols-[1.1fr_1.2fr_auto_auto_auto]"
              >
                <span className="font-mono text-[13px] text-ink">{b.evaluation_id}</span>
                <span className="truncate text-[13px] text-mute">{b.policy_id}</span>
                <span>
                  <StatusPill status={b.status} />
                </span>
                <span>
                  <OutcomePill status={b.last_status} />
                </span>
                <span className="text-right text-[12px] text-mute">
                  {fromNow(b.created_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
