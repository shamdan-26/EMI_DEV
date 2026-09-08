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
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs', 'manual-test-cases');
const OUT = path.join(DOCS, 'EMI Manual Test Cases - BY FEATURE.xlsx');
const PROJECT_XLSX = path.join(ROOT, 'data', 'ManualTestCases.xlsx');
const ADDITIONS = path.join(DOCS, 'audit-additions.json');
const AIO_DIR = process.env['MANUAL_AIO_EXPORT_DIR']
    ?? path.join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '', 'Downloads');

const NAVY = 'FF1F4E78';
const BAND = 'FFD9E2F3';
const HEADERS = ['Sub-Area', 'TC ID', 'Title', 'Priority', 'Preconditions', 'Steps',
    'Expected Result', 'Status', 'Test Type', 'Source', 'Jira Ref'];
const WIDTHS = [26, 18, 40, 11, 34, 42, 44, 17, 19, 17, 22];
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
                'Not Tested', classify(section, title, expected, steps), ticket]);
        });
    }
    const projectCount = rows.length;

    // 2. per-epic workbooks written in this audit
    for (const entry of await readdir(DOCS, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === 'Archive') continue;
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
                        v(8) || 'Not Tested', v(9) || classify(sheet.name, v(3), v(7), v(6)), '']);
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
                    classify(sub, title, expected, steps), v('Requirements')]);
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
                a.preconditions, a.steps, a.expected, 'Not Tested', a.testType || 'Integration', '']);
            auditAdded += 1;
        }
    } catch (err) {
        console.log(`  ! audit additions skipped: ${err.message}`);
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

    const ov = wb.addWorksheet('Overview');
    ov.columns = [{ width: 34 }, { width: 55 }, { width: 16 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 15 }, { width: 14 }];
    const meta = [
        ['Category', 'Details'],
        ['Document Name', 'EMI Manual Test Cases — By Feature'],
        ['Epic / Story Ref', 'Full EMI manual suite: project docs + this audit' + (aioCount ? ' + AIO (Jira)' : '')],
        ['Release Number', 'All releases to V 6.6.0 / Sprint 74'],
        ['Environment', 'UAT'],
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
    const title = ov.addRow(['EMI Manual Test Cases — Results by Feature']);
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
            row.getCell(2 + j).value = { formula: `COUNTIF('${sn}'!$H:$H,"${s}")` };
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
    ov.addRow([]);
    ov.addRow(['Generated', new Date().toISOString()]);

    for (const feature of order) {
        const sheet = wb.addWorksheet(sheetNameOf(feature));
        sheet.columns = HEADERS.map((h, i) => ({ header: h, width: WIDTHS[i] }));
        for (const r of byFeature.get(feature)) {
            sheet.addRow([r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[1], r[11]]);
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
                cell.alignment = [2, 4, 8, 9, 10].includes(c)
                    ? { horizontal: 'center', vertical: 'top', wrapText: true }
                    : { vertical: 'top', wrapText: true };
            }
            sheet.getCell(`H${n}`).dataValidation = { type: 'list', allowBlank: true, formulae: [DV] };
        }
        sheet.addConditionalFormatting({
            ref: `H2:H${last}`,
            rules: STATUS_COLOURS.map(([value, bg, fg], i) => ({
                type: 'cellIs', operator: 'equal', priority: i + 1, formulae: [`"${value}"`],
                style: {
                    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } },
                    font: { name: 'Arial', size: 9, color: { argb: fg } },
                },
            })),
        });
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
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

    addReport('Priority Derivation',
        ['Feature', 'TC ID', 'Title', 'Current Priority', 'Rule Suggests', 'Agrees', 'Rule Applied', 'Source'],
        derivation, [26, 16, 66, 15, 14, 9, 42, 17]);

    const disagree = derivation.filter(d => d[5] === 'NO').length;
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

    await wb.xlsx.writeFile(OUT);
    console.log(`\n  ${order.length} features, ${rows.length} test cases`);
    console.log(`  project docs ${projectCount} · epic workbooks ${newCount} · AIO ${aioCount} · audit additions ${auditAdded}`);
    console.log(`  ${removed.length} duplicates removed · ${derivedCount} priorities derived`);
    console.log(`  written to ${path.relative(ROOT, OUT)}`);
};

main().catch((err) => { console.error(err); process.exit(1); });
