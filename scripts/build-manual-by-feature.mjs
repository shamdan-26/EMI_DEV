#!/usr/bin/env node
/**
 * Rebuilds docs/manual-test-cases/EMI Manual Test Cases - BY FEATURE.xlsx —
 * the whole manual suite, one sheet per feature.
 *
 *   npm run build:manual-by-feature
 *
 * Merges three sources, each tagged in a Source column so a reader can always
 * tell where a case came from:
 *
 *   Project docs      data/ManualTestCases.xlsx, itself generated from the
 *                     markdown in docs/manual-test-cases/. Run
 *                     `npm run build:manual-testcases` FIRST if you have edited
 *                     any .md file, or this renders yesterday's copy.
 *   New (this audit)  the per-epic workbooks in the subfolders of
 *                     docs/manual-test-cases, written against live Jira for
 *                     stories that had no coverage.
 *   AIO (Jira)        the EMI AIO Tests export. Not in the repo — it is a
 *                     point-in-time download. Set MANUAL_AIO_EXPORT_DIR to the
 *                     folder holding the AIO_CASE_*.xlsx files; without it the
 *                     build still runs and says how many cases were left out.
 */
import { readdir, readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs', 'manual-test-cases');
const OUT = path.join(DOCS, 'EMI Manual Test Cases - B2B - BY FEATURE.xlsx');
const B2C_DIR = path.join(DOCS, 'B2C');
const B2C_OUT = path.join(B2C_DIR, 'EMI Manual Test Cases - B2C - BY FEATURE.xlsx');
const PROJECT_XLSX = path.join(ROOT, 'data', 'ManualTestCases.xlsx');
const ADDITIONS = path.join(DOCS, 'audit-additions.json');
const ID_REGISTRY = path.join(DOCS, 'tc-id-registry.json');
const RETIRED_DUPES = path.join(DOCS, 'retired-duplicates.json');
const MERGE_PLAN_FILE = path.join(DOCS, 'merged-cases.json');
const E2E_JOURNEYS = path.join(DOCS, 'e2e-journeys.json');
const AIO_DIR = process.env['MANUAL_AIO_EXPORT_DIR']
    ?? path.join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '', 'Downloads');

const NAVY = 'FF1F4E78';
const BAND = 'FFD9E2F3';
// 'TC ID' is this suite's own identifier, uniform across every row and every
// feature. 'Source ID' keeps whatever the case was called where it came from —
// an AIO/Jira key, a markdown-doc id such as RI-01, an epic-workbook id — because
// those are what Jira and the Playwright spec titles actually reference.
const HEADERS = ['TC ID', 'Sub-Area', 'Source ID', 'Title', 'Priority', 'Preconditions', 'Steps',
    'Expected Result', 'Status', 'Test Type', 'Interface', 'Source', 'Jira Ref', 'Automated',
    'Automated By', 'Channel'];
const WIDTHS = [15, 26, 18, 40, 11, 34, 42, 44, 17, 19, 12, 17, 22, 12, 52, 10];
const AUTOMATED_XLSX = path.join(ROOT, 'test-case-exports', 'All-Automated-Test-Cases.xlsx');

/** Manual-case ids as they appear inside automated test titles. The suite uses
 *  several id shapes: EMI-TC-1234 from AIO, TC-Refund-01 style from the epic
 *  workbooks, and two-to-three letter prefixes such as LG-01 from the markdown
 *  docs. */
// The leading (?<![A-Za-z0-9-]) matters: without it "BAL-RC-01" also matches as
// "RC-01", which made a wallet-balance spec look like coverage for the
// Registration contract case RC-01. An id may not start mid-compound.
const TC_ID_RE = /(?<![A-Za-z0-9-])(?:EMI-TC-\d+|TC-[A-Za-z]+-\d+|TC-\d+|[A-Z]{2,4}-(?:E2E|INT|NFR|SEC|EDG)?-?\d+[a-z]?)\b/g;
const STATUS_COLOURS = [
    ['Passed', 'FFE2EFDA', 'FF375623'], ['Failed', 'FFFCE4D6', 'FFC65911'],
    ['Partially Passed', 'FFFFF2CC', 'FF833C0C'], ['Not Tested', 'FFEDEDED', 'FF595959'],
    ['Not Implemented', 'FFEAD1DC', 'FF7030A0'], ['NA', 'FFF2F2F2', 'FF7F7F7F'],
];
const DV = '"Passed,Failed,Partially Passed,Not Tested,Not Implemented,NA"';

// ─── Feature mapping ─────────────────────────────────────────────────────

const FOLDER_MAP = [
    [/^Registration|^Continue Registration/i, 'Registration'],
    [/^Login/i, 'Login'],
    [/^Forget Password|^Forgot/i, 'Forgot Password'],
    [/^Profile|Manage ?Accounts/i, 'Profile & Manage Accounts'],
    [/Biller Bills|Bill.?Items|Bill Management/i, 'Bill Management (Creation)'],
    [/Bill payment|Close loop/i, 'Bill Payment'],
    [/Top ?up|CashIn|Cash In/i, 'Top Up & Cash In'],
    [/Transactions -> Transfer|W2W|Wallet Transfer/i, 'Wallet Transfer (W2W)'],
    [/Bank ?Transfer|Cashout|Cash Out/i, 'Bank Transfer & Cash Out'],
    [/Money Request/i, 'Money Request'],
    [/QR/i, 'QR Payment'],
    [/Payment Link/i, 'Payment Links'],
    [/^Deep Payment/i, 'Deep Payment'],
    [/^POS|^PoS/i, 'PoS Transactions'],
    [/Reconciliation/i, 'Reconciliation'],
    [/^Sub-Wallet/i, 'Sub-Wallets'],
    [/Qattah/i, 'Qattah'],
    [/Adjustment|Reversal/i, 'Adjustments & Reversals'],
    [/^Multi-omni bus/i, 'Multi-Omnibus'],
    [/^Wallet Configuration/i, 'Wallet Configuration'],
    [/^Dashboard and Wallets|HomePage/i, 'Dashboard & Wallets'],
    [/Manage Users|Admin User|Roles and Groups|Business Privilege|Unlock Admin|RBAC/i, 'Roles & Permissions'],
    [/^Setup/i, 'Setup & Admin'],
    [/Products/i, 'Products'],
    [/Cards|Card Service|Card Management/i, 'Cards'],
    [/^Transaction Log/i, 'Transaction Log'],
    [/^Transactions|B2B/i, 'Transaction Operations'],
    [/^Notifications/i, 'Notifications'],
    [/^Reports|Fee Matrix/i, 'Reports'],
    [/^RMS/i, 'RMS'],
    [/^JIT/i, 'JIT'],
    [/^Integration|Tahaqaq|Tanfeeth/i, 'Integrations'],
    [/KYB|KYC|Mozn/i, 'KYC / KYB / AML'],
    [/^Customer YMDY/i, 'Customer App'],
    [/^Technical Updates/i, 'Technical Updates'],
    [/^System|Screen Shots|SuperApp|FE Enhancements/i, 'Platform & System'],
];
const featureOf = (folder) => {
    const f = (folder ?? '').trim();
    for (const [re, name] of FOLDER_MAP) if (re.test(f)) return name;
    return 'Other';
};

// ─── B2B vs B2C ──────────────────────────────────────────────────────────
// Decided from the AIO folder path, which is the product's own taxonomy —
// not from keywords in the case text. A keyword pass looks appealing but is
// badly wrong here: most cases mention neither audience, and "wallet holder"
// alone drags platform features like Balances into B2C.
//
// Consumer-facing in the taxonomy:
//   Customer YMDY   the consumer app — cards, beneficiaries, transfers,
//                   customer registration, transaction management
//   Qattah          the consumer split-the-bill feature
//
// Everything else is the Business Portal (merchant, biller), the Admin Portal,
// or platform and backend work — all B2B. Deep Payment is payment links on the
// business portal, Products2026 is business products, and Wallet Configuration
// is an admin tool that configures customer limits, so all three stay B2B.
const B2C_FOLDERS = /^Customer YMDY|Qattah/i;
const channelOfFolder = (folder) => (B2C_FOLDERS.test(String(folder ?? '').trim()) ? 'B2C' : 'B2B');

// ─── One business, not Biller vs Merchant ────────────────────────────────
// The product no longer asks a business to declare itself a Biller or a
// Merchant. Registration now offers Merchant only, with Freelancer present but
// disabled as "Coming Soon", and EMI-5748/5768/5777 added a fixed-Merchant mode
// that hides the selector entirely. The Biller-specific specs are retired in
// BusinessTestCases/Registration/archive/.
//
// The AIO cases predate that. Hundreds carry a "Biller - " or "Merchant - "
// prefix, and many are the SAME test written once per profile type. Rewriting
// the actor to "Business" both matches the product and lets the existing dedupe
// collapse those twins.
//
// Two things are deliberately protected:
//   MerchantID and friends — scheme terminology in the PoS flows, not an actor.
//   "Merchant Category Code" / MCC — a card-scheme field name.
const ACTOR_PREFIX = /^\s*(?:biller|merchant)s?\s*[-–—:]\s*/i;
const SCREEN_NAMES = /\b(?:biller|merchant)\s+(dashboard|manage users|bills|homepage|portal|manage beneficiary|manage benfeciary)\b/gi;
const INLINE_ACTOR = /\b(the\s+)?(biller|merchant)(s?)\b(?!\s*(?:id\b|category code))/gi;
const PROTECTED = /merchant\s*id|merchantid|merchant category code|\bmcc\b/i;

/** Rewrites Biller/Merchant to Business. Returns the text unchanged when it
 *  carries protected scheme terminology, so PoS payloads stay accurate. */
function unifyBusiness(text) {
    const s = String(text ?? '');
    if (!s || PROTECTED.test(s)) return s;
    let out = s.replace(ACTOR_PREFIX, 'Business - ');
    out = out.replace(SCREEN_NAMES, (_m, tail) => `Business ${tail}`);
    // Follow the case of the word being replaced: "Merchant Dashboard" must not
    // become "business Dashboard" in the middle of a title.
    out = out.replace(INLINE_ACTOR, (_m, the, word, plural) => {
        const upper = word[0] === word[0].toUpperCase();
        const base = plural ? 'businesses' : 'business';
        return `${the ?? ''}${upper ? base[0].toUpperCase() + base.slice(1) : base}`;
    });
    // keep sentence case where the original started the string capitalised
    return out.replace(/^business\b/, 'Business');
}

/** The cases written in this audit have no AIO folder to read a channel from,
 *  so they are classified by the feature they were written against. Cards is
 *  genuinely mixed — consumer cards from Customer YMDY sit alongside admin card
 *  configuration from Setup — but every card case added here is consumer-side. */
const B2C_FEATURES = new Set(['Customer App', 'Qattah', 'Cards']);
const channelOfFeature = (feature) => (B2C_FEATURES.has(String(feature)) ? 'B2C' : 'B2B');

/** Excel sheet names cannot hold these, and a feature key must equal its sheet
 *  name — otherwise "KYC / KYB / AML" and "KYC - KYB - AML" group as two
 *  features and one of them lands in a second sheet with a "1" suffix. */
const BAD_SHEET_CHARS = /[[\]:*?/\\]/g;
const sanitise = (f) => String(f).replace(BAD_SHEET_CHARS, '-').slice(0, 31);
const norm = (s) => String(s ?? '').toLowerCase().replace(/\W+/g, '');

// ─── Priority ────────────────────────────────────────────────────────────
// Two vocabularies arrive: P1/P2/P3 from the markdown docs, Critical/High/
// Medium/Low from AIO and this audit. Collapse to the four-level scale.
const PRIORITY_MAP = { p1: 'High', p2: 'Medium', p3: 'Low', critical: 'Critical',
    high: 'High', medium: 'Medium', low: 'Low' };

// Most AIO cases carry no priority at all. One cannot be invented, but it can be
// DERIVED from what the case itself says, using rules a QA lead can audit and
// overrule. First match wins; the rule that fired is recorded per case.
const PRIORITY_RULES = [
    ['R1 Regulatory / AML / safeguarding', 'Critical',
        /\baml\b|sanction|\bpep\b|screening|nafath|yaqeen|wathiq|\bws1\b|\bws3\b|mozn|zatca|sama|safeguard|kyc|kyb|tipping|regulator/],
    ['R2 Money movement or balance integrity', 'Critical',
        /\bdebit|\bcredit|balance|settle|reconcil|reserve|ledger|refund|revers|adjust|commission|\bvat\b|payout|transfer|top.?up|cash.?out|cash.?in|idempoten|duplicate|double/],
    ['R3 Authentication, authorisation or secrets', 'Critical',
        /\botp\b|password|token|session|privilege|\brbac\b|role|permission|unauthor|403|401|encrypt|plain.?text|hash|credential|sign.?in|login|lockout/],
    ['R4 Negative or boundary on a business flow', 'High',
        /reject|refus|declin|invalid|malformed|missing|failure|fails|error|prevent|unable|not allowed|expired|timeout|limit|exceed|breach|boundary|maximum|minimum|concurren|race/],
    ['R5 Integration or end-to-end behaviour', 'High',
        /integration|end.to.end|\be2e\b|callback|webhook|third.?party|provider|downstream|propagat/],
    ['R6 Reporting, audit or observability', 'Medium',
        /report|audit|log|export|metric|alert|trend|notification|statement|dashboard/],
    ['R7 Presentation only', 'Low',
        /display|visible|label|placeholder|tooltip|logo|icon|colou?r|font|layout|alignment|wording|translat|cosmetic|title|heading/],
];
const TYPE_FLOOR = { Security: 'Critical', Integration: 'High', 'Performance / NFR': 'High',
    'Edge / Boundary': 'High', Negative: 'High', Usability: 'Low' };
const RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/** Reading order for test types within a category: the happy path first, then
 *  what can go wrong, then the edges, then the cross-cutting concerns. */
const TYPE_ORDER = {
    Functional: 0, Negative: 1, 'Edge / Boundary': 2, Security: 3, Integration: 4,
    'Performance / NFR': 5, Usability: 6, Compliance: 7, 'Contract / API': 8,
    Configuration: 9, Localisation: 10, Observability: 11, Reporting: 12,
    'Cross-Platform': 13, Architecture: 14, Regression: 15, Migration: 16,
    'Open Question': 17,
};

function derivePriority(sub, title, steps, expected, testType) {
    const blob = `${sub} ${title} ${steps} ${expected}`.toLowerCase();
    for (const [name, pri, re] of PRIORITY_RULES) {
        if (!re.test(blob)) continue;
        const floor = TYPE_FLOOR[testType];
        // a rule may be lifted by the test type, never lowered below it
        if (floor && RANK[floor] < RANK[pri] && name !== 'R7 Presentation only') {
            return [floor, `${name} (lifted by type ${testType})`];
        }
        return [pri, name];
    }
    return [TYPE_FLOOR[testType] ?? 'Medium', `R8 Default for type ${testType || 'Functional'}`];
}

/** data/ManualTestCases.xlsx sheet name -> feature. */
const SHEET_MAP = {
    'B2B-Transactions': 'Transaction Operations',
    BankTransfer: 'Bank Transfer & Cash Out',
    'Bill-Items': 'Bill Management (Creation)',
    'EMI-5782-5783-PoS-Products-Web': 'Products',
    'EMI-5782-5783-PoS-Products': 'Products',
    ForgotPassword: 'Forgot Password',
    HomePage: 'Dashboard & Wallets',
    Login: 'Login',
    ManageAccounts: 'Profile & Manage Accounts',
    'Transaction-Operations': 'Transaction Operations',
};
/** Every Registration-* sheet folds into Registration. */
const sheetFeature = (name) =>
    name.startsWith('Registration') ? 'Registration' : (SHEET_MAP[name] ?? featureOf(name));

/** Sheet names inside the per-epic workbooks -> feature. */
const NEW_SHEET_MAP = {
    'POS Order Contact Details': 'PoS Transactions', 'POS Delivery Consent': 'PoS Transactions',
    'Device Management Impl': 'PoS Device Management', 'RBAC Roles & Groups': 'Roles & Permissions',
    'Registration Refresh Token': 'Registration', 'ANB Settlement Files': 'Reconciliation',
    'PoS Gateway Integration': 'PoS Transactions', 'Admin POS Surfaces': 'PoS Transactions',
    'Transaction Amounts & Fees': 'Transaction Operations',
    'Pending Reason & Rebuild Fix': 'Balances & Wallet Consistency',
    'Security & Logging': 'Platform & System', 'Localisation & Messages': 'Platform & System',
    'Customer App Updates': 'Customer App',
};
const NEW_WORKBOOK_FEATURE = {
    'PoS-Transactions-V6.6.0': 'PoS Transactions',
    'Balances-Wallet-Consistency-EMI-5944': 'Balances & Wallet Consistency',
    'PoS-Device-Management-EMI-5824': 'PoS Device Management',
    'Payments-TTL-EMI-6031': 'Payments TTL & Invalidation',
    'Task-Coverage-EMI': null,               // per-sheet, via NEW_SHEET_MAP
};

/** Automation module -> manual feature, for the traceability roll-up. */
const MODULE_TO_FEATURE = {
    Registration: 'Registration', Login: 'Login', ForgotPassword: 'Forgot Password',
    Homepage: 'Dashboard & Wallets', BankTransfer: 'Bank Transfer & Cash Out',
    BillManagement: 'Bill Management (Creation)', PayBill: 'Bill Payment',
    Topup: 'Top Up & Cash In', W2WTransfer: 'Wallet Transfer (W2W)',
    QRPayment: 'QR Payment', BillQr: 'QR Payment', MoneyRequest: 'Money Request',
    PaymentLinks: 'Payment Links', Products: 'Products', PosTransactions: 'PoS Transactions',
    Reconciliation: 'Reconciliation', SubWallets: 'Sub-Wallets',
    UserManagement: 'Roles & Permissions', BeneficiaryManagement: 'Profile & Manage Accounts',
    TransactionOperations: 'Transaction Operations', Transactions: 'Transaction Operations',
    TransactionLedger: 'Transaction Log', Balances: 'Balances & Wallet Consistency',
    PaymentsTtl: 'Payments TTL & Invalidation',
};

// ─── Test type ───────────────────────────────────────────────────────────

function classify(sub, title, expected, steps) {
    const blob = `${title} ${expected} ${steps}`.toLowerCase();
    if (/\bp99\b|latency|throughput|full-table scan|bounded memory|load test|performance/.test(blob)) return 'Performance / NFR';
    if (/sql injection|unauthenticated|plain[- ]text|leak|allowlist|hmac|mtls|encrypt|403|privilege|unauthorized|token/.test(blob)) return 'Security';
    if (/idempoten|duplicate|redeliver|concurrent|race|integration|callback|webhook|end.to.end|e2e/.test(blob)) return 'Integration';
    if (/\breject|\brefus|\bdeclin|invalid|malformed|missing|failure|fails|error|incorrect|wrong|not allowed|prevent|unable/.test(blob)) return 'Negative';
    if (/boundary|maximum|minimum|\bzero\b|negative|limit|exceed|over-length|special char|empty/.test(blob)) return 'Edge / Boundary';
    if (/display|visible|layout|\bui\b|screen|button|placeholder|tooltip|label/.test(blob)) return 'Usability';
    return 'Functional';
}

const SKIP_SHEETS = new Set(['Overview', 'Summary', 'Coverage Matrix', 'No Test Cases Required',
    'README', 'Review Queue', 'Restored Cases', 'Superseded Source Files',
    'Archived - Duplicates', 'Archived - Contradicts Jira', 'Archive Summary']);

const cellText = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
        if (v.text) return String(v.text);
        if (v.result !== undefined) return String(v.result);
        return '';
    }
    return String(v);
};

const main = async () => {
    const rows = [];

    // 1. project docs
    const projectWb = new ExcelJS.Workbook();
    await projectWb.xlsx.readFile(PROJECT_XLSX);
    for (const sheet of projectWb.worksheets) {
        if (sheet.name === 'Summary') continue;
        const feature = sanitise(sheetFeature(sheet.name));
        sheet.eachRow((row, n) => {
            if (n === 1) return;
            const [section, id, title, steps, expected, priority, ticket] =
                [1, 2, 3, 4, 5, 6, 7].map(c => cellText(row.getCell(c).value));
            if (!id) return;
            rows.push([feature, 'Project docs', section, id, title, priority, '', steps, expected,
                'Not Tested', classify(section, title, expected, steps), ticket, 'B2B']);
        });
    }
    const projectCount = rows.length;

    // 2. per-epic workbooks written in this audit
    for (const entry of await readdir(DOCS, { withFileTypes: true })) {
        // Skip Archive (retired cases) and B2C (this script's own output — reading
        // it back would fold the previous run into the next one and multiply the
        // suite on every build).
        if (!entry.isDirectory() || entry.name === 'Archive' || entry.name === 'B2C') continue;
        const dir = path.join(DOCS, entry.name);
        for (const file of await readdir(dir)) {
            if (!file.endsWith('.xlsx')) continue;
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.readFile(path.join(dir, file));
            for (const sheet of wb.worksheets) {
                if (SKIP_SHEETS.has(sheet.name)) continue;
                if (cellText(sheet.getRow(1).getCell(2).value) !== 'TC ID') continue;
                const fixed = NEW_WORKBOOK_FEATURE[entry.name];
                const feature = sanitise(fixed ?? NEW_SHEET_MAP[sheet.name] ?? 'Other');
                sheet.eachRow((row, n) => {
                    if (n === 1) return;
                    const v = (c) => cellText(row.getCell(c).value);
                    if (!v(2)) return;
                    rows.push([feature, 'New (this audit)', sheet.name, v(2), v(3), v(4), v(5), v(6), v(7),
                        v(8) || 'Not Tested', v(9) || classify(sheet.name, v(3), v(7), v(6)), '', 'B2B']);
                });
            }
        }
    }
    const newCount = rows.length - projectCount;

    // 3. the AIO export, if it is available on this machine
    let aioCount = 0;
    let aioNote = '';
    try {
        const files = (await readdir(AIO_DIR)).filter(f => /^AIO_CASE_.*\.xlsx$/i.test(f));
        if (!files.length) throw new Error('no AIO_CASE_*.xlsx found');
        // newest export set only — the folder accumulates older downloads
        const stamped = await Promise.all(files.map(async f => ({
            f, m: (await stat(path.join(AIO_DIR, f))).mtimeMs,
        })));
        const newest = Math.max(...stamped.map(s => s.m));
        const current = stamped.filter(s => newest - s.m < 36e5).map(s => s.f);
        for (const file of current) {
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.readFile(path.join(AIO_DIR, file));
            const sheet = wb.worksheets[0];
            const header = sheet.getRow(1).values.map(v => cellText(v));
            const col = (name) => header.indexOf(name);
            sheet.eachRow((row, n) => {
                if (n === 1) return;
                const v = (name) => cellText(row.getCell(col(name)).value);
                const key = v('Key');
                if (!key) return;
                const folder = v('Folder');
                const parts = folder.split('->').map(p => p.trim());
                const sub = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? '');
                const title = v('Title'), steps = v('Steps'), expected = v('Expected Result');
                rows.push([sanitise(featureOf(folder)), 'AIO (Jira)', sub, key, title, v('Priority'),
                    v('Pre-condition'), steps, expected, 'Not Tested',
                    classify(sub, title, expected, steps), v('Requirements'), channelOfFolder(folder)]);
                aioCount += 1;
            });
        }
        aioNote = `${current.length} export files from ${AIO_DIR}`;
    } catch (err) {
        aioNote = `NOT INCLUDED — ${err.message}. Set MANUAL_AIO_EXPORT_DIR to the folder holding AIO_CASE_*.xlsx`;
        console.log(`  ! AIO export skipped: ${err.message}`);
    }

    // 4. cases written directly into the by-feature suite — integration, NFR,
    //    security and AML/OTP coverage that has no per-epic workbook of its own.
    //    Held in audit-additions.json so a regeneration cannot drop them, which
    //    is exactly what happened before this file existed.
    let auditAdded = 0;
    try {
        const additions = JSON.parse(await readFile(ADDITIONS, 'utf8'));
        for (const a of additions) {
            rows.push([sanitise(a.feature), 'New (this audit)', a.sub, a.tcid, a.title, a.priority,
                a.preconditions, a.steps, a.expected, 'Not Tested', a.testType || 'Integration', '',
                channelOfFeature(a.feature)]);
            auditAdded += 1;
        }
    } catch (err) {
        console.log(`  ! audit additions skipped: ${err.message}`);
    }

    // ─── end-to-end journeys ─────────────────────────────────────────────
    // Flows that cross module boundaries. Kept in their own file, and given
    // their own feature sheet, so the E2E suite can be run as a set rather than
    // hunted for across thirty-eight modules.
    let e2eAdded = 0;
    try {
        const journeys = JSON.parse(await readFile(E2E_JOURNEYS, 'utf8'));
        for (const a of journeys) {
            rows.push([sanitise(a.feature), 'E2E journeys', a.sub, a.tcid, a.title, a.priority,
                a.preconditions, a.steps, a.expected, 'Not Tested', a.testType || 'Integration', '',
                channelOfFeature(a.feature)]);
            e2eAdded += 1;
        }
    } catch (err) {
        console.log(`  ! end-to-end journeys skipped: ${err.message}`);
    }

    // ─── traceability: which manual cases have automation ────────────────
    // Read the automated export and index every manual id cited in a test
    // title. Run `npm run build:testcase-exports` first if specs have changed,
    // or this reflects the previous run.
    const automationById = new Map();
    const autoTests = [];
    let autoNote = '';
    try {
        const awb = new ExcelJS.Workbook();
        await awb.xlsx.readFile(AUTOMATED_XLSX);
        const sheet = awb.getWorksheet('Test Cases');
        sheet.eachRow((row, n) => {
            if (n === 1) return;
            const module = cellText(row.getCell(2).value);
            const file = cellText(row.getCell(3).value);
            const title = cellText(row.getCell(6).value);
            const status = cellText(row.getCell(7).value);
            if (!title) return;
            autoTests.push({ module, file, title, status });
            for (const id of title.toUpperCase().match(TC_ID_RE) ?? []) {
                if (!automationById.has(id)) automationById.set(id, new Set());
                automationById.get(id).add(file.replace('BusinessTestCases/', ''));
            }
        });
        autoNote = `${autoTests.length} automated tests read from ${path.relative(ROOT, AUTOMATED_XLSX)}`;
    } catch (err) {
        autoNote = `NOT AVAILABLE — ${err.message}. Run npm run build:testcase-exports first`;
        console.log(`  ! automation traceability skipped: ${err.message}`);
    }

    // ─── unify the business actor, B2B only ──────────────────────────────
    // Runs BEFORE dedupe on purpose: once "Biller - x" and "Merchant - x" both
    // read "Business - x", the dedupe step removes the twin for free.
    const unified = [];
    for (const r of rows) {
        if (r[12] === 'B2C') continue;                 // consumer side has no biller/merchant
        const before = { sub: r[2], title: r[4], steps: r[7], expected: r[8] };
        r[2] = unifyBusiness(r[2]);
        r[4] = unifyBusiness(r[4]);
        r[7] = unifyBusiness(r[7]);
        r[8] = unifyBusiness(r[8]);
        if (before.title !== r[4] || before.sub !== r[2]) {
            unified.push([r[0], r[3], before.title, r[4], before.sub, r[2],
                before.steps !== r[7] || before.expected !== r[8] ? 'steps/expected also rewritten' : '']);
        }
    }

    // ─── retire the profile-type choice, B2B only ────────────────────────
    // Fixed-Business sign-up mode is now the only mode (EMI-5748/5768/5777):
    // registration shows a static "Signing up as Business" label, not a
    // selector. A case that exercises the CHOICE tests a control that is gone.
    //
    // Deliberately KEPT, because they assert today's behaviour — that the
    // selector is absent and the type cannot be changed: RE-03, RE-04,
    // EMI-TC-8407, EMI-TC-8408, EMI-TC-8410, EMI-TC-8413.
    const RETIRED_CHOICE = new Map([
        ['RI-21', 'Profile Type label — the selector no longer renders'],
        ['RI-22', 'Profile Type radiogroup — the selector no longer renders'],
        ['RI-23', '"Exactly two options" — there is no option list'],
        ['RI-26', 'Freelancer radio option — never shipped, selector gone'],
        ['RI-27', 'Freelancer label/description — never shipped, selector gone'],
        ['RI-44', 'Selecting a profile type is no longer possible'],
        ['RI-45', 'Freelancer disabled-state — nothing to click'],
        ['RI-52', 'aria-checked on a radio that no longer renders'],
        ['RI-53', 'aria-checked on a radio that no longer renders'],
        ['RI-54', 'Selection survives a click on a card that no longer renders'],
        ['RI-98', 'Next disabled with "only Profile Type" — not a field the user fills'],
        ['RI-102', 'Superseded by RI-99 once Profile Type stops being a field'],
        ['RI-103', 'Superseded by RI-100 once Profile Type stops being a field'],
        ['RI-104', 'Superseded by RI-101 once Profile Type stops being a field'],
        ['RI-106', 'Now describes a COMPLETE form, so it contradicts RI-107'],
        ['RI-108', 'Freelancer profile — cannot be selected'],
        ['RI-112', 'Tab 1 to Tab 2 with a Freelancer profile — cannot be selected'],
        ['RE-05', 'Control for fixed-mode OFF — there is no longer an off state'],
        ['EMI-TC-8411', 'API-driven dropdown "when mode is disabled" — no disabled state'],
        ['EMI-TC-8111', '"Sign up as" lookup options — the lookup was removed'],
    ]);
    // These stay, but the profile-type half of them has to come out.
    const REWORDED_CHOICE = new Map([
        ['RI-105', 'Be disabled with CRN + National ID only (no email)'],
        ['RI-107', 'Be enabled when all fields are filled'],
    ]);
    // Still valid, but a human should re-check the detail flagged here.
    const REVIEW_CHOICE = new Map([
        ['EMI-TC-8110', 'Field list still names the removed "Sign up as" lookup'],
        ['EMI-TC-8689', 'Persona list names Freelancer — confirm the backend still issues it'],
    ]);
    // Strips a step or precondition sentence that tells the tester to pick a type.
    const CHOICE_SENTENCE = /[^.;\n]*\b(?:select|choose|pick|set)\b[^.;\n]*\bprofile type\b[^.;\n]*[.;]?\s*/gi;
    const profileTypeReport = [];
    for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r[12] === 'B2C') continue;
        const id = r[3];
        if (RETIRED_CHOICE.has(id)) {
            profileTypeReport.push([r[0], r[2], id, r[4], 'Retired', RETIRED_CHOICE.get(id)]);
            rows.splice(i, 1);
        } else if (REWORDED_CHOICE.has(id)) {
            const was = r[4];
            r[4] = REWORDED_CHOICE.get(id);
            r[7] = String(r[7] ?? '').replace(CHOICE_SENTENCE, '');
            r[6] = String(r[6] ?? '').replace(CHOICE_SENTENCE, '');
            profileTypeReport.push([r[0], r[2], id, `${was}  →  ${r[4]}`, 'Reworded',
                'Profile Type dropped from the field set; the rest of the case still holds']);
        } else if (REVIEW_CHOICE.has(id)) {
            profileTypeReport.push([r[0], r[2], id, r[4], 'Review', REVIEW_CHOICE.get(id)]);
        }
    }

    // ─── backfill expected results the AIO source left as "na" ───────────
    // These registration cases arrived from AIO with no preconditions,
    // steps or expected result at all. The content below is derived from the
    // behaviour already covered elsewhere in this suite — RG-INT-06/07/08 and
    // EMI-TC-3294/8308/8309 for Wathiq, AML-WS1-01..04 and EMI-TC-3295/8310-8313
    // for WS1, EMI-TC-3296/8317 for WS3, and Registration-Nafath.md (RN-13..18,
    // RN-21..23) for the Nafath step.
    //
    // The EMI-TC-81xx block covers the wizard flow itself and is grounded the
    // same way: Registration-OTP.md (RO-10/15/16/19) and RegistrationSessionRefresh
    // .spec.ts (RSR-01..07, EMI-5995/EMI-6059) for the OTP and session cases,
    // Registration-Info.md RI-136/137 with the EMI-5666 resume block in
    // RegistrationInfoFunctionality.spec.ts for continue-registration,
    // Registration-Nafath.md and Registration-Products.md for the NAFATH ->
    // Products hand-off, and the Back-navigation tests in
    // RegistrationFinancialFunctionality.spec.ts (RF-74) for data preservation.
    //
    // Applied only where the source is still empty, so a later AIO fix wins
    // over this backfill.
    const EMPTY_CELL = /^\s*(?:na|n\/a|none|-|tbd)?\s*$/i;

/**
 * Content for cases the AIO source exports with "na" in every field, held in
 * docs/manual-test-cases/expected-backfill.json rather than inline here — it
 * is test-case text, not code, and it changes far more often than this script
 * does. Keys are TC ids; each value is { pre, steps, expected }.
 * A missing file is not fatal: the build just skips the backfill and says so.
 */
/**
 * The uniform TC ids, held on disk so they are STABLE: a case keeps the id it
 * was first given, and only genuinely new cases take the next free number.
 * Regenerating without this file would renumber the whole suite whenever a case
 * is added or removed, which would make the id useless for referring to a case.
 * Keyed by Source ID, which the Duplicate IDs guard proves is unique.
 */
/**
 * Cases retired because another case already covers them, keyed by Source ID
 * with the id that was KEPT. Held on disk rather than derived on the fly: the
 * decision of which copy survives is a judgement call, not something to recompute
 * every build. Only exact duplicates go in here — cases that merely share a title
 * (per-screen element checks, platform variants, one lazy title over several real
 * cases) are left alone and reported instead.
 */
function loadRetiredDupes() {
    if (!existsSync(RETIRED_DUPES)) return new Map();
    return new Map(Object.entries(JSON.parse(readFileSync(RETIRED_DUPES, 'utf8'))));
}

/**
 * Cases that collapse into one combined checklist case, from
 * docs/manual-test-cases/merged-cases.json. Only the grouping decision lives
 * there — which cases join, which id survives, what the merged case is called.
 * The checklist itself is composed at build time from the rows, so a later fix
 * to any absorbed case still shows up inside the merged one.
 */
/**
 * API or Web — how the case is DRIVEN, not what it happens to mention.
 *
 * The steps decide it. A case whose steps say "click Next and check the error"
 * is a web case even when its expected result quotes an HTTP 422, because a
 * tester runs it in a browser. A case whose steps say "POST /money-requests"
 * is an API case even when the feature also has a screen. Only when the steps
 * are silent does the id, the test type, the sub-area or the title get a say.
 *
 * Returns [value, rule] so the Interface Rules sheet can show its working.
 */
const IFACE_API_ID = /^API[-_]/i;
const IFACE_API_SUB = /\bAPI\b|backend contract/i;
const IFACE_SUB_IS_UI = /API (failure|error)|resilience/i;
const IFACE_UI_VERB = /\b(click|clicks|clicked|tap|navigate|log ?in to the|open the|load the|select the|scroll|hover|screen|page|button|dropdown|popup|dialog|modal|toggle|upload the|type in|form)\b/i;
const IFACE_API_HARD = /\b(GET|POST|PUT|PATCH|DELETE)\s+\/|\/api\/v\d|\/emi-[a-z]+\/api/i;
const IFACE_API_SOFT = /\bendpoint\b|\bAPI (call|request|contract)\b|\brequest (body|payload|header)\b|\bresponse (body|payload)\b|\bAuthorization: ?Bearer\b|\bJSON (payload|body)\b|\bcurl\b|\bPostman\b/i;

function deriveInterface(tcid, sub, title, pre, steps, expected, testType) {
    if (IFACE_API_ID.test(String(tcid))) return ['API', 'Source ID is an API case'];
    if (testType === 'Contract / API') return ['API', 'Test type is Contract / API'];
    const driver = String(steps ?? '').trim() || `${pre ?? ''} ${title ?? ''}`;
    if (IFACE_API_HARD.test(driver)) return ['API', 'Steps call an endpoint directly'];
    if (IFACE_UI_VERB.test(driver)) return ['Web', 'Steps drive the interface'];
    if (IFACE_UI_VERB.test(String(title))) return ['Web', 'The case is written about a screen'];
    if (IFACE_API_SOFT.test(driver)) return ['API', 'Steps work at the request/response level'];
    if (IFACE_API_SUB.test(String(sub)) && !IFACE_SUB_IS_UI.test(String(sub))) {
        return ['API', 'Sub-area is an API/contract area'];
    }
    if (IFACE_API_HARD.test(`${title} ${expected}`) || IFACE_API_SOFT.test(String(title))) {
        return ['API', 'The case is written against an endpoint'];
    }
    return ['Web', 'No API signal — driven through the interface'];
}

function loadMergePlan() {
    if (!existsSync(MERGE_PLAN_FILE)) return [];
    return JSON.parse(readFileSync(MERGE_PLAN_FILE, 'utf8'));
}

function loadIdRegistry() {
    if (!existsSync(ID_REGISTRY)) return {};
    return JSON.parse(readFileSync(ID_REGISTRY, 'utf8'));
}

/** Assign a uniform id to every row that does not have one yet, in a
 *  deterministic order so a rebuild from an empty registry numbers identically. */
function assignIds(registry, rows, label) {
    const prefix = `EMI-${label}`;
    const map = registry[prefix] ?? (registry[prefix] = {});
    let next = Object.values(map).reduce(
        (m, v) => Math.max(m, Number(String(v).slice(prefix.length + 1)) || 0), 0);
    const ordered = [...rows].sort((a, b) =>
        String(a[0]).localeCompare(String(b[0]))
        || String(a[2]).localeCompare(String(b[2]))
        || String(a[3]).localeCompare(String(b[3]), undefined, { numeric: true }));
    let added = 0;
    for (const r of ordered) {
        const src = String(r[3]);
        if (!src) continue;
        if (!map[src]) { map[src] = `${prefix}-${String(++next).padStart(4, '0')}`; added += 1; }
    }
    return { map, added, total: ordered.length };
}

function loadExpectedBackfill() {
    const file = path.join(DOCS, 'expected-backfill.json');
    if (!existsSync(file)) {
        console.log('  ! expected-backfill.json not found — no content backfilled');
        return new Map();
    }
    return new Map(Object.entries(JSON.parse(readFileSync(file, 'utf8'))));
}
    const EXPECTED_BACKFILL = loadExpectedBackfill();
    const backfilled = [];
    for (const r of rows) {
        const fill = EXPECTED_BACKFILL.get(r[3]);
        if (!fill || r[12] === 'B2C') continue;
        const filledFields = [];
        if (EMPTY_CELL.test(String(r[6] ?? ''))) { r[6] = fill.pre; filledFields.push('Preconditions'); }
        if (EMPTY_CELL.test(String(r[7] ?? ''))) { r[7] = fill.steps; filledFields.push('Steps'); }
        if (EMPTY_CELL.test(String(r[8] ?? ''))) { r[8] = fill.expected; filledFields.push('Expected Result'); }
        if (filledFields.length) backfilled.push([r[0], r[3], r[4], filledFields.join(', ')]);
    }

    // ─── retire exact duplicates ─────────────────────────────────────────
    const RETIRED = loadRetiredDupes();
    const retiredReport = [];
    for (let i = rows.length - 1; i >= 0; i--) {
        const hit = RETIRED.get(String(rows[i][3]));
        if (!hit) continue;
        retiredReport.push([rows[i][0], rows[i][2], rows[i][3], rows[i][4], hit.kept, hit.reason]);
        rows.splice(i, 1);
    }
    if (retiredReport.length) {
        console.log(`  ${retiredReport.length} duplicate cases retired — see the Retired - Duplicates sheet`);
    }

    // ─── merge cases that share one set of steps ──────────────────────────
    // A screen-load check is one step ("Load the Business Info tab") and one
    // assertion. Sixty of them mean loading that tab sixty times to check sixty
    // things. Merged, they are one case: load it once, then work down a numbered
    // checklist. Each check keeps the original case's title in front of its
    // expected result, so the action being checked is never lost.
    // Cases whose steps are a numbered procedure are NEVER merged — there the
    // written steps are shared but the DATA differs per case, so they are
    // different tests wearing the same steps.
    const MERGE_PLAN = loadMergePlan();
    const mergedReport = [];
    if (MERGE_PLAN.length) {
        const PRIO_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
        const rank = (p) => PRIO_RANK[String(p ?? '').toLowerCase()] ?? 0;
        const flat = (t) => String(t ?? '').replace(/\s*\n\s*/g, ' ').trim();
        const key = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        // One checklist line. Most of these cases were written as "Display the EN
        // language button" / "Display the EN language button" — title and expected
        // saying the same thing — so print the fuller of the two rather than both.
        const checkLine = (r) => {
            const title = flat(r[4]);
            const expected = flat(r[8]);
            if (!expected) return title;
            const kt = key(title);
            const ke = key(expected);
            if (ke === kt || kt.includes(ke)) return title;
            if (ke.includes(kt)) return expected;
            return `${title} — ${expected}`;
        };
        const byId = new Map(rows.filter((r) => r[12] !== 'B2C')
            .map((r) => [`${r[0]}|${r[3]}`, r]));
        const absorbed = new Set();
        for (const g of MERGE_PLAN) {
            const keeper = byId.get(`${g.feature}|${g.keep}`);
            if (!keeper) continue;
            const members = [keeper, ...g.absorb
                .map((id) => byId.get(`${g.feature}|${id}`)).filter(Boolean)];
            if (members.length < 2) continue;
            // Two members that say the same thing are one check, not two lines.
            // AIO holds several cases twice under different tickets; both twins are
            // absorbed so neither survives as a loose copy of a check, and both are
            // reported against the single check they became.
            const checks = [];
            const seen = new Map();
            const checkNo = members.map((r) => {
                const line = checkLine(r);
                const k = key(line);
                if (seen.has(k)) return seen.get(k);
                checks.push(line);
                seen.set(k, checks.length);
                return checks.length;
            });
            members.slice(1).forEach((r, i) => {
                absorbed.add(`${r[0]}|${r[3]}`);
                mergedReport.push([r[0], r[2], r[3], flat(r[4]), r[10], keeper[3], checkNo[i + 1]]);
            });
            keeper[4] = `${g.title} (${checks.length} checks)`;
            keeper[5] = members.reduce((best, r) => (rank(r[5]) > rank(best) ? r[5] : best), keeper[5]);
            // Most groups share a real starting state ("Load the Business Info tab")
            // and the keeper's own steps already say it. Where the members are field
            // states instead ("Monthly Expected Number Of Bills is 0") no member's
            // steps are a starting state, so the group supplies one.
            keeper[7] = `${flat(g.steps ?? keeper[7])}\n\nThen work through each numbered check in the `
                + 'Expected Result in turn, returning to this starting state whenever a check changes it.';
            const jira = [...new Set(members.flatMap((r) => String(r[11] ?? '').split(',')
                .map((t) => t.trim()).filter(Boolean)))];
            if (jira.length) keeper[11] = jira.join(',');
            keeper[8] = checks.map((l, i) => `${i + 1}. ${l}`).join('\n');
        }
        for (let i = rows.length - 1; i >= 0; i--) {
            if (absorbed.has(`${rows[i][0]}|${rows[i][3]}`)) rows.splice(i, 1);
        }
        if (absorbed.size) {
            console.log(`  ${absorbed.size} cases merged into ${MERGE_PLAN.length} combined checklist cases — see the Merged Cases sheet`);
        }
        // AIO holds some cases twice under different tickets. The duplicate pass runs
        // after this one, so absorbing a case removes the partner that used to collapse
        // its twin, and the twin resurfaces as a loose copy of a check line. The fix is
        // always to absorb both twins — this is what says one was missed.
        const GRADED = new Set(['Security', 'Compliance']);
        for (const g of MERGE_PLAN) {
            const keeper = byId.get(`${g.feature}|${g.keep}`);
            if (!keeper || GRADED.has(keeper[10])) continue;
            const buried = g.absorb.map((id) => byId.get(`${g.feature}|${id}`))
                .filter((r) => r && GRADED.has(r[10]));
            if (buried.length) {
                console.log(`  WARNING: ${g.keep} (${keeper[10]}) absorbs `
                    + `${buried.map((r) => `${r[3]} (${r[10]})`).join(', ')}. `
                    + 'A checklist keeps only the keeper\'s Test Type — make the graded case the keeper.');
            }
        }
        const isChecklist = (r) => /\(\d+ checks\)$/.test(String(r[4] ?? ''));
        // A twin matches the checklist on all four: the line (title and expected),
        // the shared steps, and the preconditions. Anything less is a different
        // test wearing the same words — PB-CM04 and WT-CM04 read identically and
        // are told apart only by their steps; the Top Up limit cases share a title
        // and differ in the tier values recorded in their preconditions.
        const stem = (r) => key(String(r[7] ?? '').split('\n\n')[0]);
        const checkLines = new Map();
        for (const r of rows.filter(isChecklist)) {
            for (const raw of String(r[8] ?? '').split('\n')) {
                const line = raw.replace(/^\d+\.\s*/, '').trim();
                if (!line) continue;
                // Match the WHOLE line, title and expected together. Matching the
                // title alone confuses a true twin with the shared-title problem:
                // PB-CM04 and WT-CM04 carry one title across bill payment and
                // wallet transfer, and those are two tests, not one.
                checkLines.set(`${r[0]}|${key(line)}|${stem(r)}|${key(r[6])}`, r[3]);
            }
        }
        const loose = rows.filter((r) => !isChecklist(r)
            && checkLines.has(`${r[0]}|${key(checkLine(r))}|${key(r[7])}|${key(r[6])}`));
        if (loose.length) {
            console.log(`  WARNING: ${loose.length} cases repeat a line of a merged checklist. `
                + 'Absorb them into the same group: '
                + loose.map((r) => `${r[3]} -> ${checkLines.get(`${r[0]}|${key(checkLine(r))}|${key(r[7])}|${key(r[6])}`)}`).join(', '));
        }
    }

    // ─── dedupe ──────────────────────────────────────────────────────────
    // Sub-area is part of the identity. Without it the seven "Display the MJD
    // Pay logo" cases in Registration collapse to one — but they are seven
    // different registration STEPS, so that would delete real coverage.
    const seen = new Map();
    const deduped = [];
    const removed = [];
    for (const r of rows) {
        const key = [r[0], norm(r[2]), norm(r[4]), norm(r[8]).slice(0, 120)].join('|');
        if (seen.has(key)) { removed.push([r[0], r[2], r[3], r[4], seen.get(key), 'Identical feature, sub-area, title and expected result']); continue; }
        seen.set(key, r[3]);
        deduped.push(r);
    }
    rows.length = 0;
    rows.push(...deduped);

    // ─── one priority vocabulary ─────────────────────────────────────────
    const derivation = [];
    let derivedCount = 0;
    const ruleHits = new Map();
    for (const r of rows) {
        const before = String(r[5] ?? '').trim();
        let priority = PRIORITY_MAP[before.toLowerCase()] ?? (before ? 'Medium' : '');
        const [suggested, rule] = derivePriority(r[2], r[4], r[7], r[8], r[10]);
        if (!priority) { priority = suggested; derivedCount += 1; }
        r[5] = priority;
        ruleHits.set(rule, (ruleHits.get(rule) ?? 0) + 1);
        derivation.push([r[0], r[3], String(r[4]).slice(0, 110), priority, suggested,
            priority === suggested ? 'yes' : 'NO', rule, r[1]]);
    }
    derivation.sort((a, b) => (a[5] === 'NO' ? 0 : 1) - (b[5] === 'NO' ? 0 : 1) || a[0].localeCompare(b[0]));

    // ─── API or Web ──────────────────────────────────────────────────────
    // The rule is kept on the row alongside the answer so each workbook can show
    // its own tallies — B2B and B2C are written separately from these same rows.
    const allIface = new Map();
    for (const r of rows) {
        const [value, rule] = deriveInterface(r[3], r[2], r[4], r[6], r[7], r[8], r[10]);
        r[13] = value;
        r[14] = rule;
        allIface.set(value, (allIface.get(value) ?? 0) + 1);
    }
    console.log(`  interface: ${[...allIface].map(([k, v]) => `${k} ${v}`).join(' · ')}`);

    // ─── build one workbook ──────────────────────────────────────────────
    const buildWorkbook = async (rows, outPath, label) => {
        // ─── uniform ids ─────────────────────────────────────────────────────
        const ifaceCount = new Map();
        const ifaceRules = new Map();
        for (const r of rows) {
            ifaceCount.set(r[13], (ifaceCount.get(r[13]) ?? 0) + 1);
            ifaceRules.set(r[14], (ifaceRules.get(r[14]) ?? 0) + 1);
        }

        const { map: idOf, added: newIds } = assignIds(idRegistry, rows, label);
        if (newIds) console.log(`  ${label}: ${newIds} new TC ids assigned`);

        // ─── build ───────────────────────────────────────────────────────────
        const byFeature = new Map();
        for (const r of rows) {
            if (!byFeature.has(r[0])) byFeature.set(r[0], []);
            byFeature.get(r[0]).push(r);
        }
        const order = [...byFeature.keys()].sort((a, b) => byFeature.get(b).length - byFeature.get(a).length || a.localeCompare(b));

        const wb = new ExcelJS.Workbook();
        wb.creator = 'build-manual-by-feature.mjs';
        const border = ['top', 'left', 'bottom', 'right'].reduce(
            (acc, s) => ({ ...acc, [s]: { style: 'thin', color: { argb: 'FFBFBFBF' } } }), {});
        /** A heavier top edge on the first row of each category, so the groups read
         *  as blocks without needing a blank spacer row that would break filtering. */
        const groupBorder = { ...border, top: { style: 'medium', color: { argb: 'FF1F4E78' } } };

        const ov = wb.addWorksheet('Overview');
        ov.columns = [{ width: 34 }, { width: 55 }, { width: 16 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 15 }, { width: 14 }];
        const meta = [
            ['Category', 'Details'],
            ['Document Name', `EMI Manual Test Cases — ${label} — By Feature`],
            ['Epic / Story Ref', 'Full EMI manual suite: project docs + this audit' + (aioCount ? ' + AIO (Jira)' : '')],
            ['Release Number', 'All releases to V 6.6.0 / Sprint 74'],
            ['Environment', 'DEV'],
            ['Testing Period', 'Sprint Test Execution Cycle'],
        ];
        meta.forEach((m, i) => {
            const row = ov.addRow(m);
            row.height = i === 0 ? 24 : 19.95;
            for (let c = 1; c <= 2; c += 1) {
                const cell = row.getCell(c);
                cell.border = border;
                if (i === 0) {
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
                } else {
                    cell.font = { name: 'Arial', size: 9, bold: c === 1 };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                }
            }
        });
        ov.addRow([]);
        ov.addRow([]);
        const title = ov.addRow([`EMI Manual Test Cases — ${label} — Results by Feature`]);
        title.getCell(1).font = { name: 'Arial', size: 13, bold: true, color: { argb: NAVY } };
        ov.addRow([]);
        const head = ov.addRow(['Feature', 'Passed', 'Failed', 'Partially Passed', 'Not Tested', 'Not Implemented', 'Total Checks', 'Pass Rate %']);
        head.height = 25.95;
        for (let c = 1; c <= 8; c += 1) {
            const cell = head.getCell(c);
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = border;
        }
        const headRow = head.number;
        const sheetNameOf = (f) => f.replace(/[[\]:*?/\\]/g, '-').slice(0, 31);
        order.forEach((feature, i) => {
            const n = headRow + 1 + i;
            const sn = sheetNameOf(feature);
            const row = ov.getRow(n);
            row.getCell(1).value = feature;
            ['Passed', 'Failed', 'Partially Passed', 'Not Tested', 'Not Implemented'].forEach((s, j) => {
                row.getCell(2 + j).value = { formula: `COUNTIF('${sn}'!$I:$I,"${s}")` };
            });
            row.getCell(7).value = { formula: `SUM(B${n}:F${n})` };
            row.getCell(8).value = { formula: `IF(G${n}>0,B${n}/G${n},0)` };
            row.height = 19.95;
            for (let c = 1; c <= 8; c += 1) {
                const cell = row.getCell(c);
                cell.font = { name: 'Arial', size: 9, bold: c === 1 };
                cell.border = border;
                cell.numFmt = c === 8 ? '0.0%' : c > 1 ? '#,##0' : undefined;
                cell.alignment = c === 1 ? { vertical: 'middle', wrapText: true } : { horizontal: 'center', vertical: 'middle' };
            }
        });
        const totalN = headRow + 1 + order.length;
        const totalRow = ov.getRow(totalN);
        totalRow.getCell(1).value = 'Total';
        for (let c = 2; c <= 7; c += 1) {
            const L = String.fromCharCode(64 + c);
            totalRow.getCell(c).value = { formula: `SUM(${L}${headRow + 1}:${L}${totalN - 1})` };
        }
        totalRow.getCell(8).value = { formula: `IF(G${totalN}>0,B${totalN}/G${totalN},0)` };
        totalRow.height = 22.05;
        for (let c = 1; c <= 8; c += 1) {
            const cell = totalRow.getCell(c);
            cell.font = { name: 'Arial', size: 10, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
            cell.border = border;
            cell.numFmt = c === 8 ? '0.0%' : c > 1 ? '#,##0' : undefined;
            cell.alignment = c === 1 ? { vertical: 'middle' } : { horizontal: 'center', vertical: 'middle' };
        }

        ov.addRow([]);
        const srcHead = ov.addRow(['Source', 'Test Cases', 'Notes']);
        srcHead.font = { name: 'Arial', size: 10, bold: true };
        ov.addRow(['Project docs', projectCount, 'data/ManualTestCases.xlsx — run npm run build:manual-testcases first if any .md changed']);
        ov.addRow(['New (this audit)', newCount, 'Per-epic workbooks in docs/manual-test-cases/*/']);
        ov.addRow(['AIO (Jira)', aioCount, aioNote]);
        ov.addRow(['End-to-end journeys', e2eAdded, 'docs/manual-test-cases/e2e-journeys.json — flows that cross module boundaries']);
        ov.addRow([]);
        ov.addRow(['Driven through the interface', ifaceCount.get('Web') ?? 0,
            'Interface = Web — run in a browser']);
        ov.addRow(['Driven against the API', ifaceCount.get('API') ?? 0,
            'Interface = API — run with a request client']);
        ov.addRow([]);
        ov.addRow(['Automation traceability', automationById.size, autoNote]);
        ov.addRow([]);
        ov.addRow(['Generated', new Date().toISOString()]);

        for (const feature of order) {
            const sheet = wb.addWorksheet(sheetNameOf(feature));
            sheet.columns = HEADERS.map((h, i) => ({ header: h, width: WIDTHS[i] }));

            // Rows are grouped by category (Sub-Area) and then by test type within
            // it, so a tester reading one category sees its happy path first, then
            // the negatives, edges, security and integration checks together rather
            // than scattered. Priority and TC id break any remaining ties, keeping
            // the order stable between runs.
            const ordered = [...byFeature.get(feature)].sort((a, b) =>
                String(a[2]).localeCompare(String(b[2]))
                || (TYPE_ORDER[a[10]] ?? 99) - (TYPE_ORDER[b[10]] ?? 99)
                || (RANK[a[5]] ?? 9) - (RANK[b[5]] ?? 9)
                || String(a[3]).localeCompare(String(b[3]), undefined, { numeric: true }));

            let previous = null;
            for (const r of ordered) {
                const specs = automationById.get(String(r[3]).toUpperCase());
                const row = sheet.addRow([idOf[String(r[3])] ?? '', r[2], r[3], r[4], r[5], r[6], r[7],
                    r[8], r[9], r[10], r[13], r[1], r[11],
                    specs ? 'Yes' : 'No', specs ? [...specs].slice(0, 3).join('; ') : '', r[12]]);
                // mark where a new category starts so the groups read as blocks
                const groupKey = `${r[2]}|${r[10]}`;
                if (previous !== null && String(r[2]) !== previous) row.getCell(1).border = groupBorder;
                if (previous !== null && String(r[2]) !== previous) row.getCell(2).border = groupBorder;
                previous = String(r[2]);
                void groupKey;
            }
            const last = byFeature.get(feature).length + 1;
            const h = sheet.getRow(1);
            h.height = 28.05;
            for (let c = 1; c <= HEADERS.length; c += 1) {
                const cell = h.getCell(c);
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = border;
            }
            for (let n = 2; n <= last; n += 1) {
                const row = sheet.getRow(n);
                row.height = 36;
                for (let c = 1; c <= HEADERS.length; c += 1) {
                    const cell = row.getCell(c);
                    cell.font = { name: 'Arial', size: 9 };
                    cell.border = border;
                    cell.alignment = [1, 3, 5, 9, 10, 11, 12].includes(c)
                        ? { horizontal: 'center', vertical: 'top', wrapText: true }
                        : { vertical: 'top', wrapText: true };
                }
                sheet.getCell(`I${n}`).dataValidation = { type: 'list', allowBlank: true, formulae: [DV] };
            }
            sheet.addConditionalFormatting({
                ref: `I2:I${last}`,
                rules: STATUS_COLOURS.map(([value, bg, fg], i) => ({
                    type: 'cellIs', operator: 'equal', priority: i + 1, formulae: [`"${value}"`],
                    style: {
                        fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } },
                        font: { name: 'Arial', size: 9, color: { argb: fg } },
                    },
                })),
            });
            sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
            sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: last, column: HEADERS.length } };
            console.log(`  ${String(byFeature.get(feature).length).padStart(5)}  ${feature}`);
        }

        const addReport = (title, headers, data, widths) => {
            const sheet = wb.addWorksheet(title);
            sheet.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));
            for (const row of data) sheet.addRow(row);
            const h = sheet.getRow(1);
            h.height = 28.05;
            for (let c = 1; c <= headers.length; c += 1) {
                const cell = h.getCell(c);
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = border;
            }
            for (let n = 2; n <= data.length + 1; n += 1) {
                const row = sheet.getRow(n);
                row.font = { name: 'Arial', size: 9 };
                row.alignment = { vertical: 'top', wrapText: true };
            }
            sheet.views = [{ state: 'frozen', ySplit: 1 }];
            sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(data.length + 1, 2), column: headers.length } };
        };

        addReport('Duplicates Removed',
            ['Feature', 'Sub-Area', 'Removed TC ID', 'Title', 'Kept TC ID', 'Rule'],
            removed, [26, 30, 18, 60, 18, 46]);

        const TYPES = ['Functional', 'Negative', 'Edge / Boundary', 'Security', 'Integration', 'Performance / NFR', 'Usability'];
        const coverage = order.map((f) => {
            const list = byFeature.get(f);
            const count = (t) => list.filter(r => r[10] === t).length;
            const integ = count('Integration');
            const missing = TYPES.filter(t => count(t) === 0);
            return [f, list.length, count('Functional'), count('Negative'), count('Edge / Boundary'),
                count('Security'), integ, Math.round(integ / list.length * 1000) / 10,
                count('Performance / NFR'), missing.length ? missing.join(', ') : 'none'];
        });
        addReport('Coverage by Test Type',
            ['Feature', 'Total', 'Functional', 'Negative', 'Edge / Boundary', 'Security', 'Integration', 'Integration %', 'Performance / NFR', 'Missing Types'],
            coverage, [30, 10, 12, 11, 15, 11, 13, 14, 17, 46]);

        const citedIds = new Set(automationById.keys());
        const manualIds = new Set(rows.map(r => String(r[3]).toUpperCase()));
        const orphanIds = [...citedIds].filter(id => !manualIds.has(id)).sort();

        const trace = order.map((f) => {
            const list = byFeature.get(f);
            const automated = list.filter(r => automationById.has(String(r[3]).toUpperCase())).length;
            const tests = autoTests.filter(t => (MODULE_TO_FEATURE[t.module] ?? '') === f).length;
            return [f, list.length, automated,
                Math.round(automated / list.length * 1000) / 10, tests,
                automated === 0 && tests > 0 ? 'Automation exists but cites no manual id'
                    : automated === 0 ? 'No automation'
                    : automated === list.length ? 'Fully traced' : ''];
        });
        trace.sort((a, b) => b[1] - a[1]);
        addReport('Traceability',
            ['Feature', 'Manual Cases', 'Cases With Automation', 'Traced %', 'Automated Tests In Module', 'Note'],
            trace, [30, 14, 22, 12, 26, 44]);

        if (label === 'B2B') {
            addReport('Business Unification',
                ['Feature', 'TC ID', 'Title Before', 'Title After', 'Category Before', 'Category After', 'Note'],
                unified, [24, 15, 56, 56, 26, 26, 30]);
            addReport('Backfilled Content',
                ['Feature', 'TC ID', 'Title', 'Fields Written'],
                backfilled, [20, 16, 62, 40]);
            addReport('Merged Cases',
                ['Feature', 'Category', 'Merged ID', 'Title', 'Test Type', 'Merged into', 'Check #'],
                mergedReport.sort((a, b) => String(a[0]).localeCompare(String(b[0]))
                    || String(a[5]).localeCompare(String(b[5]))
                    || Number(a[6]) - Number(b[6])),
                [24, 34, 16, 62, 18, 16, 10]);
            addReport('Retired - Duplicates',
                ['Feature', 'Category', 'Retired ID', 'Title', 'Covered by', 'Reason'],
                retiredReport.sort((a, b) => String(a[0]).localeCompare(String(b[0]))
                    || String(a[2]).localeCompare(String(b[2]), undefined, { numeric: true })),
                [24, 30, 16, 62, 16, 40]);
            addReport('Retired - Profile Type',
                ['Feature', 'Category', 'TC ID', 'Title', 'Action', 'Reason'],
                profileTypeReport.sort((a, b) => a[4].localeCompare(b[4]) || a[2].localeCompare(b[2])),
                [16, 34, 14, 62, 12, 62]);
        }

        // A TC id must identify exactly one case, or traceability silently points
        // at the wrong test. This caught RC- meaning both "Registration Contract"
        // and "Reconciliation", and RP- meaning both "Roles & Permissions" and
        // "Reports". Kept as a standing check so a new prefix clash surfaces here.
        const byId = new Map();
        for (const r of rows) {
            if (!r[3]) continue;
            if (!byId.has(r[3])) byId.set(r[3], []);
            byId.get(r[3]).push(r);
        }
        const idClashes = [];
        for (const [id, list] of byId) {
            if (list.length < 2) continue;
            for (const r of list) idClashes.push([id, r[0], r[2], r[4]]);
        }
        addReport('Duplicate IDs',
            ['TC ID', 'Feature', 'Category', 'Title'],
            idClashes.sort((a, b) => a[0].localeCompare(b[0])),
            [16, 26, 34, 70]);
        if (idClashes.length) {
            console.log(`  ! ${label}: ${idClashes.length} rows share a TC id — see the Duplicate IDs sheet`);
        }

        addReport('Automation Orphans',
            ['Cited Test Id', 'Note'],
            orphanIds.map(id => [id, 'Cited by an automated test title but not present in this manual suite']),
            [22, 90]);

        addReport('Priority Derivation',
            ['Feature', 'TC ID', 'Title', 'Current Priority', 'Rule Suggests', 'Agrees', 'Rule Applied', 'Source'],
            derivation, [26, 16, 66, 15, 14, 9, 42, 17]);

        const disagree = derivation.filter(d => d[5] === 'NO').length;
        addReport('Interface Rules',
            ['Rule', 'Interface', 'Cases Matching', 'What It Matches On'],
            [['Source ID is an API case', 'API', ifaceRules.get('Source ID is an API case') ?? 0,
              'Source ID starts with API-'],
             ['Test type is Contract / API', 'API', ifaceRules.get('Test type is Contract / API') ?? 0,
              'Test Type column'],
             ['Steps call an endpoint directly', 'API', ifaceRules.get('Steps call an endpoint directly') ?? 0,
              'Steps name an HTTP verb and path, /api/v<n>, or an /emi-<service>/api path'],
             ['Steps drive the interface', 'Web', ifaceRules.get('Steps drive the interface') ?? 0,
              'Steps click, tap, navigate, load a page, select, upload, or name a screen control'],
             ['The case is written about a screen', 'Web', ifaceRules.get('The case is written about a screen') ?? 0,
              'Steps are silent but the title names a page, screen, button or dialog'],
             ['Steps work at the request/response level', 'API', ifaceRules.get('Steps work at the request/response level') ?? 0,
              'Steps name an endpoint, request/response body, bearer header, cURL or Postman'],
             ['Sub-area is an API/contract area', 'API', ifaceRules.get('Sub-area is an API/contract area') ?? 0,
              'Sub-area names an API or backend contract — but not API-failure resilience, which is a screen test'],
             ['The case is written against an endpoint', 'API', ifaceRules.get('The case is written against an endpoint') ?? 0,
              'Steps are silent and the title or expected result names an endpoint'],
             ['No API signal — driven through the interface', 'Web',
              ifaceRules.get('No API signal — driven through the interface') ?? 0,
              'Default. Nothing in the case points at a request client']],
            [46, 12, 15, 88]);
        addReport('Priority Rules',
            ['Rule', 'Priority Assigned', 'Cases Matching', 'What It Matches On'],
            [...PRIORITY_RULES.map(([name, pri], i) => [name, pri,
                [...ruleHits.entries()].filter(([k]) => k.startsWith(name)).reduce((a, [, v]) => a + v, 0),
                ['AML, sanctions, PEP, Nafath, Yaqeen, Wathiq, WS1, WS3, MOZN, ZATCA, SAMA, KYC/KYB',
                 'Debit, credit, balance, settlement, reconciliation, reserve, ledger, refund, reversal, commission, VAT',
                 'OTP, password, token, session, privilege, RBAC, encryption, hashing, sign-in, lockout',
                 'Rejection, validation, failure, limits, expiry, timeout, concurrency, boundaries',
                 'Integration, end-to-end, callback, webhook, third party, downstream propagation',
                 'Reports, audit trails, logs, exports, metrics, alerts, statements, dashboards',
                 'Display, labels, placeholders, tooltips, logos, colours, layout, wording, translation'][i]]),
             ['R8 Default for the test type', 'By type',
                [...ruleHits.entries()].filter(([k]) => k.startsWith('R8')).reduce((a, [, v]) => a + v, 0),
                'Anything unmatched: Security -> Critical, Integration/NFR/Negative/Edge -> High, Usability -> Low, else Medium'],
             ['', '', '', ''],
             ['HOW TO READ THIS', '', '',
                `Priorities on cases that arrived without one are DERIVED from the case text, not set by the business. `
                + `The Priority Derivation sheet runs the rules against every case and flags where the stored priority and `
                + `the rule disagree — those rows sort to the top. ${disagree} of ${derivation.length} disagree, which is `
                + `expected: an authored priority should win over a rule.`]],
            [42, 18, 16, 100]);

        await wb.xlsx.writeFile(outPath);
        return order.length;
    };

    // ─── split the suite by channel ──────────────────────────────────────
    // The B2B suite is the working file. B2C lives in its own folder so the two
    // audiences can be executed, reported and released independently.
    const b2b = rows.filter(r => r[12] !== 'B2C');
    const b2c = rows.filter(r => r[12] === 'B2C');

    await mkdir(B2C_DIR, { recursive: true });
    const idRegistry = loadIdRegistry();
    const b2bFeatures = await buildWorkbook(b2b, OUT, 'B2B');
    const b2cFeatures = b2c.length ? await buildWorkbook(b2c, B2C_OUT, 'B2C') : 0;
    writeFileSync(ID_REGISTRY, JSON.stringify(idRegistry, null, 2) + '\n', 'utf8');

    console.log(`\n  sources: project docs ${projectCount} · epic workbooks ${newCount} · AIO ${aioCount} · audit additions ${auditAdded} · e2e journeys ${e2eAdded}`);
    console.log(`  ${removed.length} duplicates removed · ${derivedCount} priorities derived`);
    const allManualIds = new Set(rows.map(r => String(r[3]).toUpperCase()));
    const traced = [...automationById.keys()].filter(id => allManualIds.has(id)).length;
    console.log(`  traceability: ${traced} manual ids matched by an automated test`);
    console.log(`\n  B2B  ${String(b2b.length).padStart(5)} cases, ${b2bFeatures} features  ->  ${path.relative(ROOT, OUT)}`);
    console.log(`  B2C  ${String(b2c.length).padStart(5)} cases, ${b2cFeatures} features  ->  ${path.relative(ROOT, B2C_OUT)}`);
};

main().catch((err) => { console.error(err); process.exit(1); });
