#!/usr/bin/env node
/*
 * Runs newman over every generated EMI service collection
 * (postman/<Service>-API-majdpay.postman_collection.json) against
 * postman/EMI-dev.postman_environment.json, writing one JSON report per
 * collection under test-results/ (gitignored).
 *
 *   node scripts/run-service-collections.mjs [--token JWT] [--only Wallet,Auth] [--folder-safe]
 *
 * The two curated collections (POS, Registration) are skipped — they have their
 * own npm scripts and their own environments.
 *
 * --folder-safe restricts each run to GET-only folders is NOT available here
 * (the generated collections are foldered by tag, not by verb); instead every
 * request carries only a "no 5xx" assertion and no request writes unless its
 * body placeholders are filled in, so an unattended run is read-mostly. Still,
 * do not point --token at a privileged admin token for an unattended run.
 */
import { readdirSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const postmanDir = join(repoRoot, 'postman');
const reportDir = join(repoRoot, 'test-results');
mkdirSync(reportDir, { recursive: true });

const args = process.argv.slice(2);
const getArg = (name) => {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : undefined;
};
const token = getArg('--token');
const only = (getArg('--only') || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const CURATED = new Set(['POS-API-majdpay.postman_collection.json', 'Registration-API-majdpay.postman_collection.json']);

const collections = readdirSync(postmanDir)
    .filter((f) => f.endsWith('-API-majdpay.postman_collection.json') && !CURATED.has(f))
    .filter((f) => !only.length || only.some((o) => f.toLowerCase().includes(o)));

if (!collections.length) {
    console.error('no collections matched');
    process.exit(1);
}

const env = join(postmanDir, 'EMI-dev.postman_environment.json');
let failed = 0;

for (const file of collections) {
    const name = file.replace('-API-majdpay.postman_collection.json', '');
    const report = join(reportDir, `newman-${name.toLowerCase()}.json`);
    const newmanArgs = [
        '--yes', 'newman', 'run', join(postmanDir, file),
        '-e', env,
        '--reporters', 'cli,json',
        '--reporter-json-export', report,
        '--timeout-request', '15000',
        '--suppress-exit-code',
    ];
    if (token) newmanArgs.push('--env-var', `token=${token}`);

    console.log(`\n=== ${name} ===`);
    const res = spawnSync('npx', newmanArgs, { stdio: 'inherit', cwd: repoRoot, shell: process.platform === 'win32' });
    if (res.status !== 0) failed += 1;
}

console.log(`\n${collections.length} collections run, ${failed} with a non-zero newman exit. Reports in test-results/.`);
