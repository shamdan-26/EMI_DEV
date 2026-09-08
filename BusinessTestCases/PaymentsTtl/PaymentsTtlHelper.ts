/**
 * Payments TTL & Invalidation (EMI-6031, epic EMI-2184).
 *
 * Manual cases: docs/manual-test-cases/Payments-TTL-EMI-6031/
 * Payments TTL & Invalidation Test_Cases EMI-6031.xlsx (TC-TTL-01..41).
 *
 * ── Why this story exists ────────────────────────────────────────────────
 * A Payments TTL job ALREADY RUNS IN PRODUCTION and has never been specified.
 * Its entire written record is defect traffic:
 *   EMI-5139  the job did not execute at all — Thursday transactions were still
 *             untouched on Sunday
 *   EMI-5165  it wrote two rows per transaction into transaction_failed_reasons
 *   EMI-4762  "check and fix Payments TTL on Production", with no statement of
 *             what correct behaviour is
 * It is also absent from EMI-719's job register, so it is unmanaged,
 * unschedulable from the admin panel and unmonitored.
 *
 * ── Two stores, one clock — the main risk this suite guards ──────────────
 * DRAFT (payments outbox): mutable, non-authoritative, affects NO balance
 * bucket. Expiry marks it terminal and releases limit headroom. Nothing moves.
 * Governs INITIATED, PENDING_CHECKS, PENDING_OTP.
 *
 * LEDGER: authoritative, balance-bearing, APPEND-ONLY. Invalidation APPENDS a
 * compensating posting that unwinds the pending movement — it never updates the
 * original entry. Governs LEDGER_PENDING only.
 *
 * Conflating the two is the failure this story exists to prevent, so the two
 * spec files are deliberately kept separate rather than merged.
 *
 * ── Status ───────────────────────────────────────────────────────────────
 * EMI-6031 is To Do and no API reference exists. The paths below are INFERRED
 * from the acceptance criteria, not from a contract, and are all
 * env-overridable — a 404 against one is not a product defect until the real
 * contract is published. Every test is skipped pending the endpoints and
 * EMI-719 Jobs-section access, the same convention Reconciliation/ uses.
 */

export const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

export const TTL_IMPLEMENTED = (process.env['TTL_IMPLEMENTED'] ?? '').toLowerCase() === 'true';
export const PENDING_BUILD = 'EMI-6031 is To Do — set TTL_IMPLEMENTED=true once the job is specified and exposed';
export const PENDING_JOBS_UI = 'pending EMI-719 Jobs-section access to schedule, enable and inspect the job';
export const NO_DB = 'asserts on database state; this suite has no DB connection — verify manually or expose a read API';

export const OPS_TOKEN = process.env['TTL_OPS_TOKEN'] ?? '';
export const ADMIN_TOKEN = process.env['TTL_ADMIN_TOKEN'] ?? '';

// ─── Lifecycle states — from EMI-2184 ────────────────────────────────────

/** Draft TTL governs everything before POSTED. */
export const DRAFT_STATES = ['INITIATED', 'PENDING_CHECKS', 'PENDING_OTP'] as const;
/** Ledger TTL governs this one state, and only this one. */
export const LEDGER_PENDING = 'LEDGER_PENDING';
/** Terminal is terminal — the job must never touch these. */
export const TERMINAL_STATES = ['SUCCESS', 'FAILED'] as const;
export const DRAFT_EXPIRED = 'EXPIRED';

export const ON_EXPIRY_ACTIONS = ['AUTO_REVERSE', 'AUTO_FAIL', 'ESCALATE'] as const;
export type OnExpiryAction = (typeof ON_EXPIRY_ACTIONS)[number];

/** The actor every TTL-driven action must be audit-logged against. */
export const TTL_ACTOR = 'SYSTEM_TTL';

// ─── The proposed TTL & SLA matrix ───────────────────────────────────────
//
// STATUS: our proposal, sent to Finance, NOT YET CONFIRMED (Q1). These are seed
// values and business/compliance decisions — they determine how long customer
// funds may sit in an intermediate state. Re-verify every row once Finance
// responds; do not treat a mismatch as a defect before then.

export interface TtlRule {
    type: string;
    ttl: string;
    onExpiry: OnExpiryAction;
    alertThreshold: string;
}

export const PROPOSED_TTL_MATRIX: TtlRule[] = [
    { type: 'CASH_IN_PG',        ttl: '30m',            onExpiry: 'AUTO_REVERSE', alertThreshold: '15m' },
    { type: 'CASH_IN_BANK',      ttl: '2 business days', onExpiry: 'ESCALATE',     alertThreshold: '24h' },
    { type: 'CASHOUT',           ttl: '1 business day',  onExpiry: 'AUTO_REVERSE', alertThreshold: '4h' },
    { type: 'BILL_PAYMENT',      ttl: '2h',              onExpiry: 'AUTO_REVERSE', alertThreshold: '30m' },
    { type: 'EXTERNAL_PAYMENT',  ttl: '1 business day',  onExpiry: 'ESCALATE',     alertThreshold: '4h' },
    { type: 'W2W',               ttl: '5m',              onExpiry: 'AUTO_REVERSE', alertThreshold: '2m' },
    { type: 'QR_PAYMENT',        ttl: '5m',              onExpiry: 'AUTO_REVERSE', alertThreshold: '2m' },
    { type: 'REVERSAL',          ttl: '24h',             onExpiry: 'ESCALATE',     alertThreshold: '4h' },
    { type: 'ADJUSTMENT',        ttl: '2 business days', onExpiry: 'ESCALATE',     alertThreshold: '1 business day' },
    { type: 'REFUND',            ttl: '1 business day',  onExpiry: 'ESCALATE',     alertThreshold: '4h' },
];

/** Currency SAR, all times Asia/Riyadh, against the Saudi business calendar. */
export const TIMEZONE = 'Asia/Riyadh';
/** Friday and Saturday. A business-day TTL must not elapse across them —
 *  the EMI-5139 signature was transactions on Thursday, verified Sunday. */
export const WEEKEND_DAYS = ['Friday', 'Saturday'] as const;

/** True when the span crosses a Saudi weekend, so a business-day TTL should not
 *  have elapsed. Deliberately simple: the point is to express the rule the job
 *  must honour, not to reimplement the platform's calendar. */
export function crossesSaudiWeekend(from: Date, to: Date): boolean {
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const day = d.getUTCDay();          // 5 = Friday, 6 = Saturday
        if (day === 5 || day === 6) return true;
    }
    return false;
}

// ─── Paths — INFERRED, not documented. Override per environment. ─────────

export const TTL_JOB_RUN_PATH = process.env['TTL_JOB_RUN_PATH'] ?? '/api/v1/job/payments-ttl';
export const TTL_CONFIG_PATH = process.env['TTL_CONFIG_PATH'] ?? '/api/v1/admin/jobs/payments-ttl/config';
export const TTL_ESCALATIONS_PATH = process.env['TTL_ESCALATIONS_PATH'] ?? '/api/v1/admin/jobs/payments-ttl/escalations';

export function commonHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        Accept: '*/*',
        'Accept-Language': 'en_uk',
        ...extra,
    };
}

export function authHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
    return commonHeaders({ Authorization: `Bearer ${token}`, ...extra });
}
