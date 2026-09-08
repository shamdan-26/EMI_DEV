/**
 * Balances & Wallet Consistency (epic EMI-5944).
 *
 * Prevention  — EMI-5947 consumer partitioning, EMI-5948 consumer idempotency,
 *               EMI-5949 transaction lifecycle ordering guard.
 * Detection   — EMI-5950 bucket identity & variance, EMI-5951 stuck reserves.
 * Repair      — EMI-5946 wallet balance recompute (routine, order-independent),
 *               EMI-5945 statement history rebuild (break-glass, ordered).
 * Sealing     — EMI-5954 wallet daily close, EMI-5955 EMI_MISSING resolution.
 *
 * Manual cases: docs/manual-test-cases/Balances-Wallet-Consistency-EMI-5944/
 * Balances & Wallet Consistency Test_Cases EMI-5944.xlsx (255 cases, 10 sheets).
 * Test ids below carry their TC-* id so the workbook and this suite stay
 * traceable to each other.
 *
 * ── Status: every story in this epic is To Do ────────────────────────────
 * None of it is built, and no API reference exists for any of it — unlike
 * PosTransactionsHelper.ts, whose paths all come from a published document.
 * The constants below split into two kinds and it matters which is which:
 *
 *   DOCUMENTED — the four-bucket model, the per-wallet identity and the
 *   cross-wallet conservation rule are defined on EMI-602 (amended
 *   2026-08-01), sourced from docs/Financial Engine/
 *   Transaction-Lifecycle-Contract.md. These are safe to assert against.
 *
 *   INFERRED — every path and payload shape. They are best-effort, taken from
 *   the story's acceptance criteria rather than a contract, and are all
 *   env-overridable. Do not treat a 404 against one as a product defect until
 *   the real contract is published.
 *
 * Every test is skipped pending the endpoints existing and Finance-Lead
 * tooling access, the same convention Reconciliation/ uses.
 */

export const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

/** Flip once the epic ships and the endpoints below are real. */
export const BALANCES_IMPLEMENTED = (process.env['BALANCES_IMPLEMENTED'] ?? '').toLowerCase() === 'true';
export const PENDING_BUILD = 'EMI-5944 epic is To Do — set BALANCES_IMPLEMENTED=true once the endpoints exist';
export const PENDING_TOOLING = 'pending Finance-Lead / Admin Portal tooling access for balance repair';
export const NO_DB = 'asserts on database state; this suite has no DB connection — verify manually or expose a read API';

/** A Finance Lead token. Business sign-in cannot mint one, so it is supplied. */
export const FINANCE_LEAD_TOKEN = process.env['BALANCES_FINANCE_LEAD_TOKEN'] ?? '';
/** A token deliberately WITHOUT the recompute privilege, for the 403 checks. */
export const NO_PRIVILEGE_TOKEN = process.env['BALANCES_NO_PRIVILEGE_TOKEN'] ?? '';

export const WALLET_ID = process.env['BALANCES_WALLET_ID'] ?? '';
export const WALLET_CODE = process.env['BALANCES_WALLET_CODE'] ?? '';
/** A commission or VAT wallet — the ones observed going temporarily negative. */
export const COMMISSION_WALLET_CODE = process.env['BALANCES_COMMISSION_WALLET_CODE'] ?? '';

// ─── The four-bucket model — DOCUMENTED on EMI-602 ───────────────────────

export const BUCKETS = ['available', 'reserve_debit', 'reserve_credit', 'current'] as const;
export type Bucket = (typeof BUCKETS)[number];

export interface WalletBuckets {
    available: number;
    reserve_debit: number;
    reserve_credit: number;
    current: number;
}

/**
 * The per-wallet identity: `current = available + reserve_debit`.
 *
 * `reserve_credit` is EXCLUDED from `current` — money arriving on an unsettled
 * incoming payment is not the holder's yet. The intuitive
 * `available + reserve_credit − reserve_debit` is wrong, and the epic calls it
 * the most commonly misread rule in the model. Asserting it the wrong way round
 * is the single easiest way to write a test that passes against a broken build.
 */
export function satisfiesIdentity(b: WalletBuckets, tolerance = 0): boolean {
    return Math.abs(b.current - (b.available + b.reserve_debit)) <= tolerance;
}

/**
 * The cross-wallet conservation rule, per transaction, for the duration of the
 * reserve window:
 *
 *   sender.reserve_debit === SUM(reserve_credit) across receiver + commission + VAT
 *
 * Strictly stronger than the per-wallet identity, and the more valuable of the
 * two: a leg that was NEVER CREATED leaves every individual wallet internally
 * consistent, so only this check can see it. That is the failure mode behind
 * the reserve-never-released defect class (EMI-2013, EMI-4591, EMI-5771).
 */
export function conservationDelta(senderReserveDebit: number, destinationReserveCredits: number[]): number {
    return senderReserveDebit - destinationReserveCredits.reduce((a, b) => a + b, 0);
}

/** A shortfall means a leg was never applied — points at EMI-5949. */
export const isShortfall = (delta: number): boolean => delta > 0;
/** A surplus means a leg was applied twice — points at EMI-5948. */
export const isSurplus = (delta: number): boolean => delta < 0;

/**
 * Q5, resolved 2026-08-03: a negative `available` is TOLERATED. It is recorded
 * as variance and alerted, never rejected and never clamped to zero, because
 * commission and VAT wallets go temporarily negative during the reserve window.
 * No non-negativity constraint exists — a test asserting one would fail against
 * a correct build.
 */
export const NEGATIVE_AVAILABLE_TOLERATED = true;

// ─── Run outcomes — from the EMI-5945/5946 acceptance criteria ────────────

export const RUN_STATUSES = ['RUNNING', 'COMPLETED', 'NO_OP', 'FAILED', 'PARTIAL'] as const;
export const RECOMPUTE_SCOPES = ['ALL', 'WALLET_CODES', 'WALLET_ID'] as const;

// ─── Paths — INFERRED, not documented. Override per environment. ─────────

export const RECOMPUTE_PATH = process.env['BALANCES_RECOMPUTE_PATH'] ?? '/api/v1/wallets/balance/recompute';
export const REBUILD_PATH = process.env['BALANCES_REBUILD_PATH'] ?? '/reconciliation/internal/rebuild';
export const VARIANCE_PATH = process.env['BALANCES_VARIANCE_PATH'] ?? '/api/v1/wallets/balance/variance';
export const STUCK_RESERVES_PATH = process.env['BALANCES_STUCK_RESERVES_PATH'] ?? '/api/v1/wallets/reserves/stuck';
export const DAILY_CLOSE_PATH = process.env['BALANCES_DAILY_CLOSE_PATH'] ?? '/api/v1/wallets/daily-close';

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
