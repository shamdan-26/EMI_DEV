#!/usr/bin/env node
/**
 * Rebuilds data/ManualTestCases.xlsx from the markdown sources in
 * docs/manual-test-cases/.
 *
 * The markdown files are the source of truth. This script only renders them,
 * so re-run it whenever a .md file changes:
 *
 *   npm run build:manual-testcases
 *
 * It reads every `## Section` heading and the test-case table beneath it. A
 * table is only picked up when its header row starts `| ID | Title |` — that
 * is what keeps reference tables (endpoint lists, ticket indexes) out of the
 * output.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'docs', 'manual-test-cases');
const OUT = path.join(ROOT, 'data', 'ManualTestCases.xlsx');

const NAVY = 'FF1F4E78';
const BAND = 'FFD9E2F3';
const COLUMNS = ['Section', 'ID', 'Title', 'Steps', 'Expected Result', 'Priority', 'Ticket', 'Status'];
const WIDTHS = [30, 14, 44, 46, 50, 10, 16, 18];
const STATUS_COLOURS = [
    ['Passed', 'FFE2EFDA', 'FF375623'],
    ['Failed', 'FFFCE4D6', 'FFC65911'],
    ['Partially Passed', 'FFFFF2CC', 'FF833C0C'],
    ['Not Tested', 'FFEDEDED', 'FF595959'],
    ['Not Implemented', 'FFEAD1DC', 'FF7030A0'],
    ['NA', 'FFF2F2F2', 'FF7F7F7F'],
];

/** Split a markdown table row on unescaped pipes. */
function splitRow(line) {
    const cells = [];
    let cur = '';
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '\\' && line[i + 1] === '|') { cur += '|'; i += 1; continue; }
        if (ch === '|') { cells.push(cur); cur = ''; continue; }
        cur += ch;
    }
    cells.push(cur);
    // a well-formed row starts and ends with a pipe, so drop the empty edges
    if (cells.length && cells[0].trim() === '') cells.shift();
    if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
    return cells.map((c) => c.trim());
}

const isSeparator = (line) => /^\|[\s:|-]+\|$/.test(line.trim());

function parseMarkdown(text) {
    const lines = text.split(/\r?\n/);
    const rows = [];
    let section = '';
    let header = null;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];

        const heading = line.match(/^##\s+(.*\S)\s*$/);
        if (heading) { section = heading[1].trim(); header = null; continue; }

        if (!line.trim().startsWith('|')) { header = null; continue; }
        if (isSeparator(line)) continue;

        const cells = splitRow(line);
        const lower = cells.map((c) => c.toLowerCase());

        // Header row of a test-case table. Column order and presence vary between
        // documents — ManageAccounts.md, for one, has a Jira column and no Steps —
        // so match on the columns being there, not on their position.
        if (lower[0] === 'id' && lower.includes('title')) { header = lower; continue; }
        if (!header) continue;                      // a table we do not care about

        const get = (...names) => {
            for (const name of names) {
                const idx = header.indexOf(name);
                if (idx !== -1 && (cells[idx] ?? '').trim()) return cells[idx].trim();
            }
            return '';
        };
        const id = get('id');
        if (!id) continue;
        rows.push({
            section,
            id,
            title: get('title'),
            steps: get('steps', 'test steps'),
            expected: get('expected result', 'expected'),
            priority: get('priority'),
            ticket: get('ticket', 'jira', 'source ticket'),
        });
    }
    return rows;
}

const sheetName = (base) => base.replace(/[\[\]:*?/\\]/g, '-').slice(0, 31);

function styleHeader(sheet, count) {
    const row = sheet.getRow(1);
    row.height = 28.05;
    for (let c = 1; c <= count; c += 1) {
        const cell = row.getCell(c);
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = ['top', 'left', 'bottom', 'right'].reduce(
            (acc, side) => ({ ...acc, [side]: { style: 'thin', color: { argb: 'FFBFBFBF' } } }), {});
    }
}

function styleBody(sheet, count, lastRow) {
    for (let r = 2; r <= lastRow; r += 1) {
        const row = sheet.getRow(r);
        row.height = 36;
        for (let c = 1; c <= count; c += 1) {
            const cell = row.getCell(c);
            cell.font = { name: 'Arial', size: 9 };
            cell.alignment = [2, 6, 8].includes(c)
                ? { horizontal: 'center', vertical: 'top', wrapText: true }
                : { vertical: 'top', wrapText: true };
            cell.border = ['top', 'left', 'bottom', 'right'].reduce(
                (acc, side) => ({ ...acc, [side]: { style: 'thin', color: { argb: 'FFBFBFBF' } } }), {});
        }
    }
}

const main = async () => {
    const files = (await readdir(SRC_DIR))
        .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
        .sort();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'build-manual-testcases.mjs';
    wb.created = new Date();

    const summary = wb.addWorksheet('Summary');
    summary.columns = [
        { header: 'Document', key: 'doc', width: 46 },
        { header: 'Sheet', key: 'sheet', width: 34 },
        { header: 'Test Case Count', key: 'count', width: 18 },
    ];
    styleHeader(summary, 3);

    let total = 0;
    const parsed = [];

    for (const file of files) {
        const text = await readFile(path.join(SRC_DIR, file), 'utf8');
        const rows = parseMarkdown(text);
        if (!rows.length) {
            console.log(`  skipped ${file} — no test-case tables found`);
            continue;
        }
        parsed.push({ file, rows });
        total += rows.length;
    }

    for (const { file, rows } of parsed) {
        const base = path.basename(file, '.md');
        const name = sheetName(base);
        const sheet = wb.addWorksheet(name);
        sheet.columns = COLUMNS.map((header, i) => ({ header, width: WIDTHS[i] }));

        for (const r of rows) {
            sheet.addRow([r.section, r.id, r.title, r.steps, r.expected, r.priority, r.ticket, 'Not Tested']);
        }

        styleHeader(sheet, COLUMNS.length);
        styleBody(sheet, COLUMNS.length, rows.length + 1);
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: COLUMNS.length } };

        const statusRange = `H2:H${rows.length + 1}`;
        sheet.addConditionalFormatting({
            ref: statusRange,
            rules: STATUS_COLOURS.map(([value, bg, fg], i) => ({
                type: 'cellIs', operator: 'equal', priority: i + 1, formulae: [`"${value}"`],
                style: {
                    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } },
                    font: { name: 'Arial', size: 9, color: { argb: fg } },
                },
            })),
        });
        for (let r = 2; r <= rows.length + 1; r += 1) {
            sheet.getCell(`H${r}`).dataValidation = {
                type: 'list', allowBlank: true,
                formulae: ['"Passed,Failed,Partially Passed,Not Tested,Not Implemented,NA"'],
            };
        }

        summary.addRow({ doc: `docs/manual-test-cases/${file}`, sheet: name, count: rows.length });
        console.log(`  ${String(rows.length).padStart(4)}  ${name}`);
    }

    const totalRow = summary.addRow({ doc: 'Total', sheet: '', count: total });
    totalRow.height = 22.05;
    for (let c = 1; c <= 3; c += 1) {
        const cell = totalRow.getCell(c);
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    }
    styleBody(summary, 3, summary.rowCount - 1);
    summary.views = [{ state: 'frozen', ySplit: 1 }];

    await wb.xlsx.writeFile(OUT);
    console.log(`\n  ${parsed.length} documents, ${total} test cases`);
    console.log(`  written to ${path.relative(ROOT, OUT)}`);
};

main().catch((err) => { console.error(err); process.exit(1); });
