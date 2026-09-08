#!/usr/bin/env node
/**
 * Rebuilds test-case-exports/ from the Playwright specs under BusinessTestCases/.
 *
 *   npm run build:testcase-exports
 *
 * Produces one workbook per feature module plus a combined
 * All-Automated-Test-Cases.xlsx. The specs are the source of truth; this only
 * renders them, so re-run it after adding or renaming tests.
 *
 * ── Why it shells out to Playwright ──────────────────────────────────────
 * Titles come from `playwright test --list`, not from parsing the source. The
 * repo has data-driven suites — `test(data.testName, …)` and
 * `test(`${data.testName} | ${data.amountType}`, …)` inside a loop — whose real
 * titles only exist at runtime. A static parser reports one row for a block
 * that actually produces twenty tests, which is how an export quietly
 * under-counts. Playwright expands them properly.
 *
 * The source is still parsed, but only for what --list does not carry: whether
 * a test sits in a serial describe, and the reason string on any test.skip()
 * gate. Files Playwright does not register (the ServiceApis scaffolds, which
 * are wrapped in an env flag) are picked up from source so coverage written but
 * not currently registered is still visible.
 *
 * Status vocabulary matches the existing exports:
 *   Archived  the spec lives in an archive/ folder
 *   Skipped   unconditionally skipped — `test.skip(true, …)` or `test.describe.skip`
 *   Active    everything else, including tests behind a conditional
 *             `test.skip(!FLAG, …)` gate, which run once the flag is set. The
 *             gate is recorded in Notes so a reader can see why a green run
 *             reported skips.
 */
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'BusinessTestCases');
const OUT_DIR = path.join(ROOT, 'test-case-exports');

const NAVY = 'FF1F4E79';
const HEADERS = ['#', 'Module', 'Spec File', 'Describe Block', 'Nested Describe',
    'Test Case Title', 'Status', 'Serial Mode', 'Notes'];
const WIDTHS = [6, 22, 58, 44, 30, 62, 12, 13, 48];

const norm = (p) => p.replace(/\\/g, '/');

async function walk(dir) {
    const out = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else if (entry.name.endsWith('.spec.ts')) out.push(full);
    }
    return out;
}

const DESCRIBE_RE = /^\s*test\.describe(?:\.[a-zA-Z]+)*\s*\(/;
const TEST_CALL_RE = /^\s*test(?:\.(?:skip|only|fixme))?\s*\(/;
const HOOK_RE = /^\s*test\.(?:beforeAll|afterAll|beforeEach|afterEach|setTimeout|use|slow|step|info|describe)\b/;

/**
 * A test DECLARATION, as opposed to a `test.skip(cond, reason)` statement
 * inside one. Both start `test.skip(` at the head of a line, so matching on
 * that alone makes a body scan stop on its own first statement — which silently
 * empties the Notes column and reports hard-skipped tests as Active. A
 * declaration always carries a callback; a skip statement never does.
 */
const isDeclaration = (line) =>
    TEST_CALL_RE.test(line) && !HOOK_RE.test(line) && (/\basync\b/.test(line) || /=>/.test(line));

/**
 * String constants declared in a file, so a skip reason given as an identifier
 * can be resolved to its text. Both this repo's specs and the ones added for
 * EMI-5918/5944/6031 write `test.skip(!FLAG, NOT_BUILT)` rather than inlining
 * the sentence, so matching only string literals leaves most of Notes empty.
 * Helper-imported constants stay unresolved and fall back to the identifier,
 * which is still more useful than a blank cell.
 */
function localConsts(text) {
    const consts = new Map();
    const re = /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*(['"`])((?:\\.|(?!\2)[^\\])*)\2/gm;
    for (const m of text.matchAll(re)) consts.set(m[1], m[3].replace(/\\(['"`])/g, '$1'));
    return consts;
}

/** Per-file metadata keyed by the line a test is declared on. */
function parseMeta(text, sharedConsts = new Map()) {
    const lines = text.split(/\r?\n/);
    const meta = new Map();
    const consts = new Map([...sharedConsts, ...localConsts(text)]);

    const reasonText = (raw) => {
        const trimmed = raw.trim().replace(/[,)]\s*$/, '');
        const literal = trimmed.match(/^(['"`])((?:\\.|(?!\1)[^\\])*)\1$/);
        if (literal) return literal[2].replace(/\\(['"`])/g, '$1');
        return consts.get(trimmed) ?? trimmed;
    };

    const isSerialAt = (idx) => {
        // nearest preceding describe; the repo always puts the configure call
        // immediately inside it, so a short lookahead is enough
        for (let i = idx; i >= 0; i -= 1) {
            if (!DESCRIBE_RE.test(lines[i])) continue;
            const window = lines.slice(i, i + 4).join(' ');
            return /test\.describe\.serial\s*\(/.test(lines[i]) || /mode:\s*'serial'/.test(window);
        }
        return false;
    };

    for (let i = 0; i < lines.length; i += 1) {
        if (!isDeclaration(lines[i])) continue;

        // body runs to the next declaration, capped
        let end = Math.min(i + 120, lines.length);
        for (let j = i + 1; j < end; j += 1) {
            if (isDeclaration(lines[j]) || DESCRIBE_RE.test(lines[j])) { end = j; break; }
        }
        const body = lines.slice(i, end).join('\n');

        const hardSkip = /^\s*test\.skip\s*\(/.test(lines[i]) || /test\.skip\s*\(\s*true\b/.test(body);
        const conditional = /test\.skip\s*\(\s*!/.test(body);
        // second argument of the first test.skip(...) — a literal or an identifier
        const reason = body.match(/test\.skip\s*\([^,)]*,\s*([^;]+?)\)\s*;/);
        const note = reason
            ? `${conditional && !hardSkip ? 'Gated: ' : 'Skipped: '}${reasonText(reason[1])}`
            : '';

        // Playwright reports 1-based lines
        meta.set(i + 1, { serial: isSerialAt(i), hardSkip, note });
    }
    return meta;
}

/** Best-effort static extraction, for files Playwright never registers. */
function parseStatic(rel, text) {
    const lines = text.split(/\r?\n/);
    const rows = [];
    const stack = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (DESCRIBE_RE.test(line)) {
            const m = line.match(/\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/);
            stack.length = 0;
            if (m) stack.push(m[2]);
            continue;
        }
        if (!isDeclaration(line)) continue;
        const m = line.match(/\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/);
        rows.push({ title: m ? m[2] : '(computed at runtime)', describe: stack[0] ?? '', line: i + 1 });
    }
    return rows;
}

function styleHeader(sheet, count) {
    const row = sheet.getRow(1);
    row.height = 24;
    for (let c = 1; c <= count; c += 1) {
        const cell = row.getCell(c);
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
}

function addTestCaseSheet(wb, rows) {
    const sheet = wb.addWorksheet('Test Cases');
    sheet.columns = HEADERS.map((header, i) => ({ header, width: WIDTHS[i] }));
    rows.forEach((r, i) => {
        sheet.addRow([i + 1, r.module, r.specFile, r.describe, r.nested, r.title, r.status, r.serial, r.notes]);
    });
    styleHeader(sheet, HEADERS.length);
    for (let n = 2; n <= rows.length + 1; n += 1) {
        sheet.getRow(n).alignment = { vertical: 'top', wrapText: true };
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: HEADERS.length } };
}

function addSummarySheet(wb, label, rows, extra = []) {
    const sheet = wb.addWorksheet('Summary');
    sheet.columns = [{ width: 54 }, { width: 24 }];
    const put = (a, b) => sheet.addRow([a, b ?? '']);
    const bold = () => { sheet.lastRow.font = { bold: true }; };

    put(`Summary — ${label}`);
    sheet.getRow(1).font = { bold: true, size: 14 };
    put('');
    put('Generated', new Date().toISOString());
    put('Total test cases', rows.length);
    put('');

    put('Count per sub-folder'); bold();
    const folders = {};
    for (const r of rows) {
        const m = r.specFile.match(/\/(api|functional|ui|archive|security)\//);
        const key = m ? m[1] : '(root)';
        folders[key] = (folders[key] ?? 0) + 1;
    }
    for (const k of Object.keys(folders).sort()) put(k, folders[k]);
    put('');

    put('Count by status'); bold();
    for (const s of ['Active', 'Skipped', 'Archived']) put(s, rows.filter(r => r.status === s).length);
    put('');
    put('Gated behind an env flag', rows.filter(r => r.notes.startsWith('Gated:')).length);
    put('Spec files', new Set(rows.map(r => r.specFile)).size);
    for (const [a, b] of extra) { put(a, b); }
    return sheet;
}

const main = async () => {
    await mkdir(OUT_DIR, { recursive: true });

    // 1. authoritative list from Playwright
    const jsonPath = path.join(tmpdir(), `pw-list-${process.pid}.json`);
    console.log('  listing tests via Playwright…');
    await run('npx', ['playwright', 'test', '--list', '--reporter=json'], {
        cwd: ROOT, shell: true, maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath },
    }).catch(() => { /* --list exits non-zero on some versions; the file is still written */ });
    const report = JSON.parse(await readFile(jsonPath, 'utf8'));
    await rm(jsonPath, { force: true });

    const listed = [];
    const collect = (suite, trail) => {
        for (const spec of suite.specs ?? []) listed.push({ spec, trail });
        for (const child of suite.suites ?? []) collect(child, [...trail, child.title]);
    };
    for (const suite of report.suites ?? []) collect(suite, [suite.title]);

    // 2. source metadata Playwright does not carry
    const files = (await walk(SRC)).sort();
    const metaByFile = new Map();
    const textByFile = new Map();
    for (const file of files) {
        const rel = norm(path.relative(ROOT, file));
        const text = await readFile(file, 'utf8');
        textByFile.set(rel, text);
        const helperDir = path.dirname(path.dirname(file));
        let shared = new Map();
        try {
            const helpers = (await readdir(helperDir)).filter(f => f.endsWith('Helper.ts'));
            for (const h of helpers) {
                shared = new Map([...shared, ...localConsts(await readFile(path.join(helperDir, h), 'utf8'))]);
            }
        } catch { /* no helper alongside — fine */ }
        metaByFile.set(rel, parseMeta(text, shared));
    }

    const rows = [];
    const seenFiles = new Set();
    for (const { spec, trail } of listed) {
        const rel = norm(path.join('BusinessTestCases', spec.file));
        seenFiles.add(rel);
        const meta = metaByFile.get(rel)?.get(spec.line) ?? { serial: false, hardSkip: false, note: '' };
        const annotated = (spec.tests ?? []).some(t => (t.annotations ?? []).some(a => a.type === 'skip'));
        // trail[0] is the file name Playwright prepends; the describes follow
        const describes = trail.slice(1).filter(Boolean);
        rows.push({
            module: rel.split('/')[1] ?? '',
            specFile: rel,
            describe: describes[0] ?? '',
            nested: describes.length > 1 ? describes[describes.length - 1] : '',
            title: spec.title,
            status: /\/archive\//i.test(rel) ? 'Archived'
                : (meta.hardSkip || annotated) ? 'Skipped' : 'Active',
            serial: meta.serial ? 'Yes' : 'No',
            notes: meta.note,
        });
    }

    // 3. spec files Playwright never registered — coverage that exists but is gated off
    let unregistered = 0;
    for (const [rel, text] of textByFile) {
        if (seenFiles.has(rel)) continue;
        for (const r of parseStatic(rel, text)) {
            const meta = metaByFile.get(rel)?.get(r.line) ?? { serial: false, hardSkip: false, note: '' };
            rows.push({
                module: rel.split('/')[1] ?? '',
                specFile: rel,
                describe: r.describe,
                nested: '',
                title: r.title,
                status: 'Skipped',
                serial: meta.serial ? 'Yes' : 'No',
                notes: meta.note || 'Not registered — wrapped in an env flag, so Playwright does not discover it',
            });
            unregistered += 1;
        }
    }

    const byModule = new Map();
    for (const r of rows) {
        if (!byModule.has(r.module)) byModule.set(r.module, []);
        byModule.get(r.module).push(r);
    }

    for (const [module, moduleRows] of [...byModule].sort((a, b) => a[0].localeCompare(b[0]))) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'build-testcase-exports.mjs';
        addTestCaseSheet(wb, moduleRows);
        addSummarySheet(wb, module, moduleRows);
        await wb.xlsx.writeFile(path.join(OUT_DIR, `${module}.xlsx`));
        console.log(`  ${String(moduleRows.length).padStart(4)}  ${module}`);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'build-testcase-exports.mjs';
    addTestCaseSheet(wb, rows);
    const summary = addSummarySheet(wb, 'All automated test cases', rows, [
        ['Registered by Playwright', listed.length],
        ['Present in source but not registered', unregistered],
    ]);
    summary.addRow([]);
    summary.addRow(['Count by module']);
    summary.lastRow.font = { bold: true };
    for (const [module, moduleRows] of [...byModule].sort((a, b) => b[1].length - a[1].length)) {
        summary.addRow([module, moduleRows.length]);
    }
    await wb.xlsx.writeFile(path.join(OUT_DIR, 'All-Automated-Test-Cases.xlsx'));

    console.log(`\n  ${byModule.size} modules, ${textByFile.size} spec files, ${rows.length} test cases`);
    console.log(`  ${listed.length} registered by Playwright, ${unregistered} present in source but gated off`);
    console.log(`  written to ${path.relative(ROOT, OUT_DIR)}/`);
};

main().catch((err) => { console.error(err); process.exit(1); });
