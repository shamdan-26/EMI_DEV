import type { APIRequestContext, Page } from '@playwright/test';
import { VALID_COMPANY, VALID_MOBILE, VALID_PASSWORD } from '../Login/LoginHelper';
import { waitForToastClear } from '../toastMessages';

/**
 * POS Transactions, Ledger, ACH Transfers and Terminal Callback — shared API helpers.
 *
 * Endpoints and payloads come from the three API references written against
 * `product-management-service`: pos-api-reference-business.md,
 * pos-api-reference-admin.md and pos-api-reference-integration.md. Every path,
 * header, enum and validation rule below is documented there — nothing here is a
 * best-effort guess, unlike TransactionsHelper.ts.
 *
 * Manual test cases these specs automate live in
 * `POS-API-Manual-Test-Cases.xlsx` (TC-001..TC-109); each test title carries its
 * TC id so the workbook and the suite stay traceable to each other.
 *
 * Three things this suite cannot self-provision, all env-gated so the affected
 * tests skip with a readable reason instead of failing:
 *   1. An admin token — the business portal sign-in flow issues merchant tokens
 *      only, so `POS_ADMIN_TOKEN` must be supplied.
 *   2. A callback token holding POS_TRANSACTION_CALLBACK — `POS_CALLBACK_TOKEN`.
 *   3. Permission to actually move money — ACH release/reject send real payment
 *      instructions to the bank, so they stay off unless
 *      `POS_ACH_ALLOW_MUTATIONS=true` is set deliberately.
 */

// ─── Environment ─────────────────────────────────────────────────────────────

/** NOTE: `API_BASE_URL` is still absent from every `.env.*` file, so this falls
 *  back to dev regardless of ENV — the same known gap that affects
 *  Login/Registration/ForgotPassword `*APIFlow.spec.ts`. Add it to `.env.uat` /
 *  `.env.preprod` before trusting a non-dev run of this suite. */
export const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

/** The web portal origin, for the two POS screens added by EMI-6011 / EMI-6013 /
 *  EMI-6015. Distinct from API_BASE, which is the gateway. */
export const BASE_URL_WEB = process.env['BASE_URL'] ?? 'https://uat.majdpay.com';

export const DEVICE_FINGERPRINT = process.env['POS_DEVICE_FINGERPRINT'] ?? 'test-fingerprint-hash-api-testing';

/** Tokens that cannot be minted by the business sign-in flow. Empty = skip. */
export const ADMIN_TOKEN           = process.env['POS_ADMIN_TOKEN'] ?? '';
export const ADMIN_READONLY_TOKEN  = process.env['POS_ADMIN_READONLY_TOKEN'] ?? '';
export const CALLBACK_TOKEN        = process.env['POS_CALLBACK_TOKEN'] ?? '';
export const MERCHANT_2_TOKEN      = process.env['POS_MERCHANT_2_TOKEN'] ?? '';
export const NO_PRIVILEGE_TOKEN    = process.env['POS_NO_PRIVILEGE_TOKEN'] ?? '';
export const EXPIRED_TOKEN         = process.env['POS_EXPIRED_TOKEN'] ?? '';

/** Test data. Defaults mirror the API-reference examples; override per environment. */
export const TERMINAL_ID           = process.env['POS_TERMINAL_ID'] ?? 'T0012345';
export const WALLET_REFERENCE      = process.env['POS_WALLET_REFERENCE'] ?? 'WLT-0099';
export const MERCHANT_ID           = process.env['POS_MERCHANT_ID'] ?? '123456789012';
export const PROFILE_CODE          = process.env['POS_PROFILE_CODE'] ?? '';
/** A terminal / wallet owned by a DIFFERENT merchant — for the cross-tenant checks. */
export const OTHER_TERMINAL_ID     = process.env['POS_OTHER_TERMINAL_ID'] ?? '';
export const OTHER_WALLET_REFERENCE = process.env['POS_OTHER_WALLET_REFERENCE'] ?? '';

/** ACH mutation guard — release and reject instruct the bank to move money. */
export const ALLOW_ACH_MUTATIONS   = (process.env['POS_ACH_ALLOW_MUTATIONS'] ?? '').toLowerCase() === 'true';
export const ACH_MUTATION_GUARD    = 'ACH release/reject moves real money — set POS_ACH_ALLOW_MUTATIONS=true to enable';
/** A batch known to be in AWAITING_APPROVAL, for the release/reject happy paths. */
export const AWAITING_BATCH_REF    = process.env['POS_ACH_AWAITING_BATCH_REF'] ?? '';
export const RELEASED_BATCH_REF    = process.env['POS_ACH_RELEASED_BATCH_REF'] ?? '';

// ─── Paths ───────────────────────────────────────────────────────────────────

export const POS_TRANSACTIONS       = '/api/v1/pos/transactions';
export const POS_TRANSACTION_TERMS  = '/api/v1/pos/transactions/terminals';
export const POS_LEDGER_TERMINALS   = '/api/v1/pos/ledger/terminals';
export const POS_LEDGER_WALLETS     = '/api/v1/pos/ledger/wallets';
export const POS_CALLBACK           = '/api/v1/pos/transactions/callback';
export const ADMIN_TRANSACTIONS     = '/api/v1/admin/pos/transactions';
export const ADMIN_LEDGER           = '/api/v1/admin/pos/ledger';
export const ADMIN_ACH              = '/api/v1/admin/pos/ach-transfers';
export const ADMIN_ACH_RELEASE      = '/api/v1/admin/pos/ach-transfers/release';
export const ADMIN_ACH_REJECT       = '/api/v1/admin/pos/ach-transfers/reject';

// ─── Enums (from the API references) ─────────────────────────────────────────

export const PROCESSING_STATUSES = [
    'RECEIVED', 'ACCEPTED', 'UNMATCHED', 'COMPLIANCE_HOLD', 'SETTLEMENT_HELD',
    'GROUPED', 'SETTLED', 'DISPUTED', 'FAILED_RETRYABLE', 'REJECTED', 'FAILED',
] as const;

export const LEDGER_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REVERSED'] as const;
export const LEDGER_ENTRY_TYPES = ['POS_CASH_IN', 'REVERSAL', 'SUSPENSE'] as const;
export const ACH_STATUSES = [
    'AWAITING_APPROVAL', 'APPROVED', 'PENDING', 'SUCCESSFUL', 'REVERSED', 'REJECTED',
] as const;

export const MASKED_PAN = '410621******1234';
export const FULL_PAN   = '4106214567891234';
/** `\d{6}\*+\d{4}` — the only PAN shape the callback validator accepts. */
export const MASKED_PAN_PATTERN = /^\d{6}\*+\d{4}$/;

// ─── Headers ─────────────────────────────────────────────────────────────────

export function commonHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
        'Content-Type':        'application/json',
        'Accept':              '*/*',
        'Accept-Language':     'en_uk',
        'platform':            'web',
        'device-finger-print': DEVICE_FINGERPRINT,
        ...extra,
    };
}

export function authHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
    return commonHeaders({ Authorization: `Bearer ${token}`, ...extra });
}

/** Same headers minus one, for the gateway-rejection cases. */
export function headersWithout(token: string, omit: string): Record<string, string> {
    const headers = authHeaders(token);
    delete headers[omit];
    return headers;
}

// ─── Authentication ──────────────────────────────────────────────────────────

let cachedBusinessToken: string | null = null;

/**
 * Signs in with the standard business test account and returns its access token.
 * Mirrors the 3-step chain proven in Login/api/LoginAPIFlow.spec.ts, minus the
 * device pre-registration, which sign-in does not require.
 * Returns '' rather than throwing so callers can skip cleanly.
 */
export async function getBusinessToken(request: APIRequestContext): Promise<string> {
    if (cachedBusinessToken !== null) return cachedBusinessToken;

    const res = await request.post(`${API_BASE}/auth/signin`, {
        data: {
            username:     `+966${VALID_MOBILE}`,
            password:     VALID_PASSWORD,
            tenantNumber: VALID_COMPANY,
        },
        headers: commonHeaders(),
    });

    if (!res.ok()) {
        cachedBusinessToken = '';
        return '';
    }

    const body = await res.json().catch(() => null);
    const token: string = body?.accessToken?.token ?? '';
    cachedBusinessToken = token;
    return token;
}

/**
 * Probes whether a token actually carries the POS privilege for a given path.
 * The business test account is not guaranteed to hold GET_POS_TRANSACTIONS /
 * GET_POS_LEDGER, and a whole suite reporting 403 tells nobody anything useful —
 * this lets each suite skip with an actionable reason instead.
 */
export async function hasPosAccess(request: APIRequestContext, token: string, path: string): Promise<boolean> {
    if (!token) return false;
    const res = await request.get(`${API_BASE}${path}`, { headers: authHeaders(token) });
    return res.status() !== 403 && res.status() !== 401;
}

// ─── Callback payload builder ────────────────────────────────────────────────

/** Fresh per call so repeated runs are new transactions, not duplicate replays. */
export function freshStan(): string {
    return String(Math.floor(Math.random() * 900000) + 100000);
}

export function freshRrn(): string {
    return String(Date.now()).slice(-12);
}

export type MadaResult = Record<string, unknown>;

/**
 * Builds a valid MADA terminal callback payload, with any field overridable.
 * Pass `undefined` for a field to drop the key entirely (for the missing-field
 * cases) — `JSON.stringify` omits undefined values, but Playwright serialises
 * `data` itself, so the key is deleted explicitly here instead.
 */
export function buildCallback(overrides: MadaResult = {}): { madaArchives: { madaTransactionResult: MadaResult } } {
    const madaTransactionResult: MadaResult = {
        Retailer:               'ACME Retail LLC',
        Performance:            'OK',
        BankId:                 '01',
        MerchantId:             MERCHANT_ID,
        TerminalId:             TERMINAL_ID,
        Mcc:                    '5411',
        Stan:                   freshStan(),
        Version:                '1.0',
        Rrn:                    freshRrn(),
        CardScheme:             'MADA',
        ApplicationLabel:       'MADA',
        Pan:                    MASKED_PAN,
        CardExpiryDate:         '2812',
        TransactionType:        'PURCHASE',
        Amount:                 { Amount: 150.00 },
        Result:                 'APPROVED',
        CardholderVerification: 'PIN',
        ApprovalCode:           '654321',
        EmvTags: {
            PosEntryMode:       '051',
            ResponseCode:       '00',
            TerminalStatusCode: '00',
            AID:                'A0000000041010',
            TVR:                '0000008000',
            TSI:                'E800',
            CVR:                '0000000000',
            ACI:                'Y',
            AC:                 '1234567890ABCDEF',
            KID:                '01',
            PAR:                '',
            FPAN:               '',
        },
        Campaign: { QrCodeData: '', CampaignText: '' },
        ...overrides,
    };

    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) delete madaTransactionResult[key];
    }

    return { madaArchives: { madaTransactionResult } };
}

// ─── Shared assertions ───────────────────────────────────────────────────────

/** Every list endpoint in this service returns a raw Spring Data `Page<T>`. */
export interface SpringPage<T = Record<string, unknown>> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
    numberOfElements: number;
    empty: boolean;
}

export function isSpringPage(body: unknown): body is SpringPage {
    if (typeof body !== 'object' || body === null) return false;
    const page = body as Record<string, unknown>;
    return Array.isArray(page['content'])
        && typeof page['totalElements'] === 'number'
        && typeof page['number'] === 'number'
        && typeof page['size'] === 'number';
}

/**
 * Framework-level errors come back as an array of ErrorMessageDto, but
 * filter-level (401) failures may return a single bare object — accept both.
 */
export function firstError(body: unknown): Record<string, unknown> | null {
    if (Array.isArray(body)) return (body[0] as Record<string, unknown>) ?? null;
    if (typeof body === 'object' && body !== null) return body as Record<string, unknown>;
    return null;
}

/** A client error (4xx) — used where the reference documents a rejection but not
 *  its exact status, e.g. PosDeviceNotFoundException. A 5xx there is a defect. */
export function isClientError(status: number): boolean {
    return status >= 400 && status < 500;
}

// ═════════════════════════════════════════════════════════════════════════
// Second wave — POS defect sweep and the two web screens (EMI-59xx/60xx)
// ═════════════════════════════════════════════════════════════════════════
//
// API defects covered by api/PosCallbackDefects.spec.ts and
// api/PosApiContractDefects.spec.ts:
//   EMI-5978 failed callback rows carry no failed_reason
//   EMI-5979 full unmasked PAN persisted in pos_callback_entries
//   EMI-5980 malformed / empty callback body answers 500 instead of a 4xx
//   EMI-5981 required headers validated inconsistently
//   EMI-5982 ledger row stuck at PENDING instead of AWAITING_SETTLEMENT
//   EMI-5984 a failed callback is not recorded in the base transaction table
//   EMI-6045 CardExpiryDate "2902" stored as the year 2902
//   EMI-6046 idempotency key built from TID+RRN only
//   EMI-6047 missing token answers 404 instead of 401
//   EMI-6048 an expired token still returns results
//   EMI-6049 size=0 answers 500 instead of a validation error
//   EMI-6050 Accept-Language change ignored until the session is replaced
//   EMI-6051 ledger-by-terminal + dateFrom answers 500
//   EMI-6052 wallet code not owned by the token answers POS_DEVICE_NOT_FOUND
//   EMI-6053 posDeviceId null on every admin transaction row
//   EMI-6055 currency null on every admin ledger entry
//   EMI-6060 mixed ACH release batch answers MALFORMED_REQUEST_BODY
//   EMI-6062 ACH release reason > 255 chars answers a bare INVALID_ code
//
// Web screens covered by ui/PosDeviceTransactions.spec.ts and
// ui/AchRecords.spec.ts: EMI-6011 (Business POS device transactions),
// EMI-6013 (Admin POS device transactions), EMI-6015 (Admin ACH Records),
// EMI-6063/6064/6065 (ACH Records status key, wallet code column, view
// details).

// ─── Additional confirmed paths ──────────────────────────────────────────

/** EMI-6051 curl: ledger-by-terminal accepts a `dateFrom` ISO-8601 instant. */
export const POS_LEDGER_TERMINAL_PATH = (terminalId: string) => `${POS_LEDGER_TERMINALS}/${terminalId}`;
/** EMI-6052 curl: ledger-by-wallet is addressed by wallet code, not id. */
export const POS_LEDGER_WALLET_PATH = (walletCode: string) => `${POS_LEDGER_WALLETS}/${walletCode}`;
/** EMI-6050 curl: transactions-by-terminal, the endpoint the locale bug was found on. */
export const POS_TRANSACTIONS_TERMINAL_PATH = (terminalId: string) => `${POS_TRANSACTION_TERMS}/${terminalId}`;

/** A terminal id that is guaranteed not to exist — EMI-6050 uses T9999999. */
export const UNKNOWN_TERMINAL_ID = 'T9999999';
/** A wallet code owned by a different merchant than the token — EMI-6052. */
export const UNRELATED_WALLET_CODE = process.env['POS_UNRELATED_WALLET_CODE'] ?? 'MER-8D8P9M4QP6-24';

/** EMI-6062: the documented cap on the ACH release/reject `reason` field. */
export const ACH_REASON_MAX_LENGTH = 255;
/** EMI-6060: the per-batch result codes a mixed release must return. */
export const ACH_RELEASE_RESULTS = ['RELEASED', 'ALREADY_RELEASED', 'NOT_FOUND', 'INVALID_STATUS'] as const;

/** Ledger statuses a booked POS transaction must reach (EMI-5982). */
export const SETTLEMENT_PENDING_STATUS = 'AWAITING_SETTLEMENT';

// ─── Locale helpers (EMI-6050) ───────────────────────────────────────────

/**
 * The gateway takes the locale from BOTH `Accept-Language` and the `locale`
 * header (every curl in the EMI-60xx tickets sends both). EMI-6050 is that a
 * change to them is ignored until the session token is replaced, so a test has
 * to be able to flip them together on the same token.
 */
export function localeHeaders(token: string, locale: 'en_uk' | 'ar_sa'): Record<string, string> {
    return authHeaders(token, { 'Accept-Language': locale, locale });
}

/** Arabic script test — a translated message must contain Arabic letters. */
export const ARABIC_SCRIPT = /[؀-ۿ]/;

// ─── XML callback builder (EMI-5980, EMI-5981, EMI-6045) ─────────────────

/**
 * The terminal posts XML, not JSON — every callback repro in EMI-5978..5984,
 * EMI-6045 and EMI-6046 uses `Content-Type: application/xml` with a
 * `<madaArchives>` document. buildCallback() above produces the JSON shape used
 * by the older TC-078..TC-109 specs; this produces the XML the defect tickets
 * actually reproduced against, so the header-validation and malformed-body
 * cases can be driven exactly as reported.
 */
export function buildCallbackXml(overrides: {
    terminalId?: string;
    merchantId?: string;
    stan?: string;
    rrn?: string;
    pan?: string;
    cardExpiryDate?: string;
    amount?: string;
    result?: string;
    /** PURCHASE by default; REFUND and VOID are the other event types EMI-5915 accepts. */
    transactionType?: PosEventType;
    /** EMI-5918: the RRN of the sale this refund reverses. Emitted as
     *  `<OriginalRRN>`, omitted entirely when absent so the unlinked-refund
     *  parking case can be driven. */
    originalRrn?: string;
} = {}): string {
    const {
        terminalId = TERMINAL_ID,
        merchantId = MERCHANT_ID,
        stan = `STAN${freshStan()}`,
        rrn = freshRrn(),
        pan = MASKED_PAN,
        cardExpiryDate = '2812',
        amount = '10.00',
        result = 'ACCEPTED',
        transactionType = 'PURCHASE',
        originalRrn,
    } = overrides;

    const arabicType = transactionType === 'REFUND' ? 'استرجاع'
        : transactionType === 'VOID' ? 'إلغاء' : 'شراء';
    const amountLabel = transactionType === 'REFUND' ? 'REFUND AMOUNT' : 'PURCHASE AMOUNT';
    const originalLine = originalRrn ? `\n        <OriginalRRN>${originalRrn}</OriginalRRN>` : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<madaArchives>
    <madaTransactionResult>
        <Retailer RetailerNameEng="INTERNATIONAL SOFTWARE EST" RetailerNameArb="مؤسسة البرامج الدولية"/>
        <Performance StartDateTime="28082026170729" EndDateTime="28082026170731"/>
        <BankId>RAJB</BankId>
        <MerchantID>${merchantId}</MerchantID>
        <TerminalID>${terminalId}</TerminalID>
        <MCC>7399</MCC>
        <STAN>${stan}</STAN>
        <Version>1.2.76</Version>
        <RRN>${rrn}</RRN>${originalLine}
        <CardScheme ID="P1" Arabic="مدى" English="mada"/>
        <ApplicationLabel Arabic="مدى" English="mada"/>
        <PAN>${pan}</PAN>
        <CardExpiryDate>${cardExpiryDate}</CardExpiryDate>
        <TransactionType Arabic="${arabicType}" English="${transactionType}"/>
        <Amounts ArabicCurrency="ريال" EnglishCurrency="SAR">
            <Amount ArabicName="مبلغ الشراء" EnglishName="${amountLabel}">${amount}</Amount>
        </Amounts>
        <Result Arabic="مقبولة" English="${result}"/>
    </madaTransactionResult>
</madaArchives>`;
}

// ─── EMI-5918 PoS Refunds ────────────────────────────────────────────────
//
// Manual cases: docs/manual-test-cases/PoS-Transactions-V6.6.0/…MASTER.xlsx,
// sheet "PoS Refunds" (TC-Refund-01..40). Automated in api/PosRefunds.spec.ts.
//
// The story's defining property is what does NOT happen: ANB's settlement
// report is settled-only and excludes refunds, so no batch forms, no aggregate
// is written, and NO WALLET DEBIT IS EVER RAISED. The suite's job is largely to
// prove those absences, which is why so much of it reads balances before and
// after rather than asserting a new record appeared.

export const POS_EVENT_TYPES = ['PURCHASE', 'REFUND', 'VOID'] as const;
export type PosEventType = (typeof POS_EVENT_TYPES)[number];

/** Configurable per EMI-5918 criterion B; 180 days is the documented default. */
export const REFUND_WINDOW_DAYS = Number(process.env['POS_REFUND_WINDOW_DAYS'] ?? '180');
/** A refund whose original never arrives escalates after this long. */
export const REFUND_PARK_ESCALATION_HOURS = 48;

/**
 * Sums the ledger amounts a wallet holds, so a test can assert a refund moved
 * nothing. Returns null when the ledger cannot be read, letting the caller skip
 * rather than pass vacuously on an empty list.
 */
export async function walletLedgerTotal(
    request: APIRequestContext, token: string, walletCode: string,
): Promise<number | null> {
    const res = await request.get(`${API_BASE}${POS_LEDGER_WALLET_PATH(walletCode)}?page=0&size=200`, {
        headers: authHeaders(token),
    });
    if (!res.ok()) return null;
    const body = await res.json().catch(() => null);
    if (!isSpringPage(body)) return null;
    return body.content.reduce((sum, row) => {
        const amount = Number((row as Record<string, unknown>)['amount'] ?? 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
}

/** Finds a stored POS transaction by its RRN, or null. */
export async function findByRrn(
    request: APIRequestContext, token: string, rrn: string,
): Promise<Record<string, unknown> | null> {
    const res = await request.get(`${API_BASE}${POS_TRANSACTIONS}?page=0&size=200`, {
        headers: authHeaders(token),
    });
    if (!res.ok()) return null;
    const body = await res.json().catch(() => null);
    if (!isSpringPage(body)) return null;
    return (body.content.find(r => (r as Record<string, unknown>)['rrn'] === rrn) as Record<string, unknown>) ?? null;
}

/** Headers the terminal actually sends — XML, not JSON. */
export function callbackXmlHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
    return {
        'Content-Type':    'application/xml',
        'Accept':          '*/*',
        'Accept-Language': 'en_uk',
        Authorization:     `Bearer ${token}`,
        ...extra,
    };
}

/**
 * EMI-6046: the idempotency key must be TID + RRN + STAN + Date, with TID + RRN
 * only as a fallback. Two callbacks differing solely in STAN are therefore two
 * distinct transactions — under the pre-fix key they collapsed into one.
 */
export function idempotencyInputs(terminalId: string, rrn: string, stan: string, date: string): string {
    return [terminalId, rrn, stan, date].join(':');
}

/** EMI-5979: a stored/returned PAN must never be the full 16 digits. */
export function isFullPan(value: unknown): boolean {
    return typeof value === 'string' && /^\d{13,19}$/.test(value);
}

// ═════════════════════════════════════════════════════════════════════════
// Web-screen mocks — POS Device Transactions and ACH Records
// ═════════════════════════════════════════════════════════════════════════
//
// Everything above this line drives the gateway directly with an
// APIRequestContext. The two screens below are UI, so they need page.route()
// mocks and a Page instead. Both live here rather than in a second helper file
// because the repo convention is one `<Feature>Helper.ts` per feature folder.

export const POS_BUSINESS_TRANSACTIONS_URL = `${BASE_URL_WEB}/business/main/pos-transactions`;
export const POS_ADMIN_TRANSACTIONS_URL    = `${BASE_URL_WEB}/admin/main/pos-transactions`;
export const ACH_RECORDS_URL               = `${BASE_URL_WEB}/admin/main/ach-records`;

export const POS_TRANSACTIONS_ROUTE = '**/api/v1/**pos/transactions**';
export const POS_ADMIN_TRANSACTIONS_ROUTE = '**/api/v1/admin/pos/transactions**';
export const ACH_TRANSFERS_ROUTE = '**/api/v1/admin/pos/ach-transfers**';

export interface PosTransactionRow {
    id: number;
    terminalId: string;
    posDeviceId: number | null;
    walletCode: string;
    maskedPan: string;
    amount: number;
    currency: string | null;
    processingStatus: string;
    rrn: string;
    stan: string;
    transactionDate: string;
}

export function posTransactionRows(count = 3, overrides: Partial<PosTransactionRow> = {}): PosTransactionRow[] {
    return Array.from({ length: count }, (_, i) => ({
        id: 1000 + i,
        terminalId: TERMINAL_ID,
        posDeviceId: 42,
        walletCode: WALLET_REFERENCE,
        maskedPan: MASKED_PAN,
        amount: 150 + i,
        currency: 'SAR',
        processingStatus: 'ACCEPTED',
        rrn: `52850500005${i}`,
        stan: `10000${i}`,
        transactionDate: '2026-09-02T10:54:25Z',
        ...overrides,
    }));
}

export interface AchRecordRow {
    id: number;
    reconBatchRefNum: string;
    walletCode: string;
    terminalId: string;
    memberCount: number;
    transferAmount: number;
    beneficiaryAccountIban: string;
    beneficiaryName: string;
    status: string;
    allowedActions: string[];
    matchedAt: string;
    approvedAt: string | null;
    sentAt: string | null;
    valueDate: string | null;
}

export function achRecordRows(): AchRecordRow[] {
    return [
        {
            id: 1, reconBatchRefNum: 'BATCH-0001', walletCode: WALLET_REFERENCE, terminalId: TERMINAL_ID,
            memberCount: 4, transferAmount: 1250.75,
            // EMI-6036: beneficiary IBAN and name must be populated on the row.
            beneficiaryAccountIban: 'SA0380000000608010167519', beneficiaryName: 'ACME Retail LLC',
            status: 'AWAITING_APPROVAL', allowedActions: ['RELEASE', 'REJECT'],
            matchedAt: '2026-09-02T10:54:25.207875700Z', approvedAt: null, sentAt: null, valueDate: null,
        },
        {
            id: 2, reconBatchRefNum: 'BATCH-0002', walletCode: 'MER-8D8P9M4QP6-24', terminalId: TERMINAL_ID,
            memberCount: 2, transferAmount: 480.00,
            beneficiaryAccountIban: 'SA4420000001234567891234', beneficiaryName: 'Beta Trading Co',
            status: 'SUCCESSFUL', allowedActions: [],
            matchedAt: '2026-09-02T10:54:25.207875700Z',
            approvedAt: '2026-09-02T10:54:46.517262300Z',
            sentAt: '2026-09-02T10:54:46.517262600Z', valueDate: null,
        },
    ];
}

function springPageBody(content: unknown[]): string {
    return JSON.stringify({
        content, totalElements: content.length, totalPages: 1, size: 20, number: 0,
        first: true, last: true, numberOfElements: content.length, empty: content.length === 0,
    });
}

/**
 * Serves POS transactions, honouring `terminalId` and `processingStatus` so the
 * EMI-6011/EMI-6013 filter ACs are actually testable — a mock that ignores the
 * query params would pass even against a UI that never sends them.
 */
export async function mockPosTransactionList(page: Page, rows = posTransactionRows()): Promise<void> {
    await page.route(POS_TRANSACTIONS_ROUTE, route => {
        const params = new URL(route.request().url()).searchParams;
        const terminal = params.get('terminalId');
        const status   = params.get('processingStatus');
        const pageNo   = Number(params.get('page') ?? '0');

        let content = rows;
        if (terminal) content = content.filter(r => r.terminalId === terminal);
        if (status)   content = content.filter(r => r.processingStatus === status);
        // Page 1+ returns different ids so the "pagination without duplication"
        // AC in EMI-6011 can be asserted rather than assumed.
        if (pageNo > 0) content = content.map(r => ({ ...r, id: r.id + 5000 }));

        return route.fulfill({ status: 200, contentType: 'application/json', body: springPageBody(content) });
    });
}

export async function mockPosTransactionsEmpty(page: Page): Promise<void> {
    await page.route(POS_TRANSACTIONS_ROUTE, route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: springPageBody([]) })
    );
}

export async function mockPosTransactionsServerError(page: Page): Promise<void> {
    await page.route(POS_TRANSACTIONS_ROUTE, route =>
        route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify([{ httpStatusCode: 500, message: { messageCode: 'INTERNAL_SERVER_ERROR', plainText: 'Failed to process your request.Please contact support.' } }]),
        })
    );
}

/** EMI-6053 pre-fix state: every admin row comes back with posDeviceId null. */
export async function mockPosTransactionsWithNullDeviceId(page: Page): Promise<void> {
    await mockPosTransactionList(page, posTransactionRows(3, { posDeviceId: null }));
}

export async function mockAchRecordList(page: Page, rows = achRecordRows()): Promise<void> {
    await page.route(ACH_TRANSFERS_ROUTE, route => {
        if (route.request().method() !== 'GET') return route.fallback();
        const params = new URL(route.request().url()).searchParams;
        const terminal = params.get('terminalId');
        const content = terminal ? rows.filter(r => r.terminalId === terminal) : rows;
        return route.fulfill({ status: 200, contentType: 'application/json', body: springPageBody(content) });
    });
}

export async function mockAchRecordsEmpty(page: Page): Promise<void> {
    await page.route(ACH_TRANSFERS_ROUTE, route => {
        if (route.request().method() !== 'GET') return route.fallback();
        return route.fulfill({ status: 200, contentType: 'application/json', body: springPageBody([]) });
    });
}

/** EMI-6036 pre-fix state: AchTransfer rows carry no beneficiary IBAN or name. */
export async function mockAchRecordsWithoutBeneficiary(page: Page): Promise<void> {
    const stripped = achRecordRows().map(r => ({ ...r, beneficiaryAccountIban: null, beneficiaryName: null }));
    await mockAchRecordList(page, stripped as unknown as AchRecordRow[]);
}

export async function mockAchReleaseSuccess(page: Page): Promise<void> {
    await page.route('**/api/v1/admin/pos/ach-transfers/release', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ total: 1, succeeded: 1, failed: 0, skipped: 0, items: [{ batchRef: 'BATCH-0001', result: 'RELEASED' }] }),
        })
    );
}

export async function gotoPosBusinessTransactions(page: Page): Promise<void> {
    await page.goto(POS_BUSINESS_TRANSACTIONS_URL);
    await page.waitForLoadState('domcontentloaded');
    await waitForToastClear(page);
}

export async function gotoPosAdminTransactions(page: Page): Promise<void> {
    await page.goto(POS_ADMIN_TRANSACTIONS_URL);
    await page.waitForLoadState('domcontentloaded');
    await waitForToastClear(page);
}

export async function gotoAchRecords(page: Page): Promise<void> {
    await page.goto(ACH_RECORDS_URL);
    await page.waitForLoadState('domcontentloaded');
    await waitForToastClear(page);
}
