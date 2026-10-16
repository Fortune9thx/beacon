/** The contract's JSON records, as the views return them. */

/** The only three statuses the oracle can ever emit. */
export type Status = "COMPLIANT" | "NON_COMPLIANT" | "INCONCLUSIVE";

/**
 * An evaluation's lifecycle state. COMPLIANT / NON_COMPLIANT are terminal; a
 * CANCELLED evaluation is one that never converged and had its fee refunded.
 */
export type EvaluationStatus = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "CANCELLED";

export interface Policy {
  policy_id: string;
  sponsor: string;
  policy_text: string;
  evidence_patterns: string[];
  /** Wei, as a decimal string — exact beyond 2**53. */
  fee_amount: string;
  treasury: string;
  policy_hash: string;
  created_at: number;
}

/** A `[source index, sha256 of the full document]` pair. */
export type Fingerprint = [number, string];

export interface Evaluation {
  evaluation_id: string;
  policy_id: string;
  policy_hash: string;
  evidence_urls: string[];
  requester: string;
  /** Wei, as a decimal string — exact beyond 2**53. */
  fee: string;
  status: EvaluationStatus;
  /** The most recent round's status, including a non-converged INCONCLUSIVE. */
  last_status: Status | "";
  code: string;
  supporting_sources: number[];
  clause_ids: string[];
  fingerprints: Fingerprint[];
  attempts: number;
  created_at: number;
  evaluated_at: number;
  cancelled_at: number;
}

export interface BoardEntry {
  evaluation_id: string;
  policy_id: string;
  status: EvaluationStatus;
  last_status: Status | "";
  created_at: number;
}

export interface Config {
  owner: string;
  treasury: string;
  max_attempts: number;
  stale_timeout_seconds: number;
  max_evidence_urls: number;
  next_policy: number;
  next_evaluation: number;
}
