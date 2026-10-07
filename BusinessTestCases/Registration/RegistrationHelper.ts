import { Page, Locator, test, expect } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };
import * as fs from 'fs';
import * as path from 'path';
import { fetchOtpFromEmail } from '../../support/emailOtp';
import { waitForToastClear } from '../toastMessages';
import { RegistrationMobilePage } from '../pageElements/Registration/RegistrationMobilePage';
import { RegistrationInfoPage } from '../pageElements/Registration/RegistrationInfoPage';
import { RegistrationFinancialPage } from '../pageElements/Registration/RegistrationFinancialPage';
import { RegistrationVerificationPage } from '../pageElements/Registration/RegistrationVerificationPage';
import { RegistrationProductsPage } from '../pageElements/Registration/RegistrationProductsPage';
import { RegistrationNafathPage } from '../pageElements/Registration/RegistrationNafathPage';
import { RegistrationContractPage } from '../pageElements/Registration/RegistrationContractPage';
import registrationDefaults from '../../data/registrationDefaults.json';
import registrationAssets from '../../data/registrationAssets.json';
import { getSqlPool } from '../../support/sqlServerClient';
import { getMongoDb } from '../../support/mongoClient';

const BASE_URL = process.env['BASE_URL'] ?? 'https://uat.majdpay.com';
export const LOGIN_URL    = `${BASE_URL}/business/auth/login`;
export const REGISTER_URL = `${BASE_URL}/business/auth/register`;

export const VALID_EMAIL = registrationDefaults.validEmail;

// Verification & Uploads step (Tab 3) — shared valid test data
export const VALID_IBAN       = registrationDefaults.validIban;
export const VALID_VAT_NUMBER = registrationDefaults.validVatNumber;

/** Minimal 1x1 PNG used as a stand-in upload file across registration file-upload tests. */
export const TEST_FILE_BUFFER = Buffer.from(registrationDefaults.testFileBase64, 'base64');

/** Generates a unique email for each test run to avoid duplicate-registration rejections. */
export function generateEmail(): string {
    return `test+${Date.now()}@dg-cash.com`;
}

// Pre-generated test assets (from National_IDs_Generated) — see data/registrationAssets.json.
// One merged `assets` pool tagged with `type: "citizen" | "resident"` (National ID prefix
// 1 = citizen, 2 = resident) rather than two separate arrays, so both round-robin helpers
// below share a single growing dataset.
const CITIZEN_ASSETS = registrationAssets.assets.filter(a => a.type === 'citizen');
export const RESIDENT_ASSETS = registrationAssets.assets.filter(a => a.type === 'resident');

// Primary defaults resident pool used for Business Info step
export const VALID_CRN    = RESIDENT_ASSETS[0].crn;
export const VALID_IQAMA  = RESIDENT_ASSETS[0].nationalId;
export const VALID_MOBILE = RESIDENT_ASSETS[0].mobile;

/**
 * Reserved sub-pool exclusively for the "should start a brand-new registration
 * when the mobile is reused with a different CRN" test in
 * RegistrationInfoFunctionality.spec.ts (EMI-122 T21). That test draws two
 * resident assets per run via nextResidentAsset() — the same pool every other
 * Registration spec file/describe block draws from — and was confirmed to fail
 * in full bulk runs (while passing in isolation) purely from contention over
 * shared identities, not a real regression (see the
 * project_resident_assets_worker_index_races memory). Carving out the last N
 * assets and excluding them from nextResidentAsset()'s pool means this test
 * stops contending with the rest of the suite. Reserved from the tail
 * deliberately — the fixed-index pattern used elsewhere
 * (RESIDENT_ASSETS[workerIndex % length], workerIndex always small) only ever
 * touches the front of the array, so it never collides with this reservation.
 */
const MOBILE_REUSE_POOL_SIZE = 30;
const MOBILE_REUSE_MOBILES = new Set(RESIDENT_ASSETS.slice(-MOBILE_REUSE_POOL_SIZE).map(a => a.mobile));
const MOBILE_REUSE_ASSETS = RESIDENT_ASSETS.filter(a => MOBILE_REUSE_MOBILES.has(a.mobile));

/**
 * Reserved sub-pool for getFreshResidentAsset() — callers that want one
 * dedicated identity of their own, isolated from nextResidentAsset()'s
 * shared pool. Without this reservation, getFreshResidentAsset() drew from
 * the same GENERAL_RESIDENT_ASSETS pool and deterministically returned the
 * very first used:false entry every time — which nextResidentAsset() could
 * also draw (it's just one asset among many available ones), so an unrelated
 * test advancing that same identity further server-side silently broke the
 * "dedicated" asset out from under its owner. Reserved directly after the
 * MOBILE_REUSE slice, same tail-reservation reasoning as that pool.
 *
 * Sized well above what one test needs: 3 of the first 10 assets tried here
 * turned out already progressed on the live UAT backend despite being
 * flagged used:false locally (this tail of the pool predates full used-flag
 * tracking, same as the front-of-pool staleness found earlier — see
 * markResidentAssetUsed). A 30%+ stale rate means a narrow reservation
 * risks exhausting itself the same way the original shared-pool
 * maxAttempts did.
 */
const DEDICATED_ASSET_POOL_SIZE = 60;
// Slice taken from the middle of the array (index 900), not the tail: live
// checks proved the tail slice (indices -90..-30) was ~100% already
// progressed to Products on both UAT and dev — some prior bulk process
// consumed that whole neighborhood. A middle slice is untested territory,
// not a guarantee of freshness, but it isn't a known-dead zone the way the
// front (~150+ confirmed used) and that tail slice are.
const DEDICATED_ASSET_START_INDEX = 900;
const DEDICATED_ASSET_MOBILES = new Set(
    RESIDENT_ASSETS.slice(DEDICATED_ASSET_START_INDEX, DEDICATED_ASSET_START_INDEX + DEDICATED_ASSET_POOL_SIZE).map(a => a.mobile)
);
const DEDICATED_RESIDENT_ASSETS = RESIDENT_ASSETS.filter(a => DEDICATED_ASSET_MOBILES.has(a.mobile));

const GENERAL_RESIDENT_ASSETS = RESIDENT_ASSETS.filter(
    a => !MOBILE_REUSE_MOBILES.has(a.mobile) && !DEDICATED_ASSET_MOBILES.has(a.mobile)
);

let _citizenIndex  = 0;
let _mobileReuseIndex = 0;

const REGISTRATION_ASSETS_PATH = path.resolve(__dirname, '../../data/registrationAssets.json');

/** Where a citizen asset ended up when it was spent by goToProductsStep. */
export type CitizenAssetOutcome = 'products' | 'contract' | 'nafath' | 'already-registered';

/** Where a resident asset ended up when it was spent by goToFinancialStep. */
export type ResidentAssetOutcome = 'products' | 'already-registered';

/**
 * Thrown by goToFinancialStep when an explicit (non-default) identity has
 * already progressed past Business Info straight to Products — a resume,
 * not a backend rejection. A dedicated `instanceof`-checkable type rather
 * than string-matching the message: goToFinancialStepWithDedicatedAsset
 * catches this specifically to mark the stale asset and move on to the next
 * one in its small reserved pool.
 */
export class AssetAlreadyProgressedError extends Error {}

/**
 * Persists one asset's `used` flag to data/registrationAssets.json — reading
 * the file fresh from disk immediately beforehand rather than serializing
 * the in-memory `registrationAssets` object imported at module load.
 *
 * playwright.config.ts runs 3 workers locally, each its own process with its
 * own private copy of that JSON from process start. Writing that stale copy
 * back clobbers every mark any other worker persisted since — confirmed via
 * a live run where goToFinancialStep marked 10 resident assets 'products'
 * (one per attempt, all logged) yet none of the 10 were on disk afterward:
 * another worker's write, still holding its own older snapshot, stomped
 * them. That's the actual cause behind repeated maxAttempts exhaustion —
 * marks were never surviving to be skipped on the next run. Re-reading right
 * before the write narrows the race to the brief gap between concurrent
 * writes instead of leaving it open for a worker's entire lifetime.
 */
function persistAssetUsedFlag(poolKey: 'assets' | 'uatOtpAssets', mobile: string, used: boolean | string): void {
    try {
        const onDisk = JSON.parse(fs.readFileSync(REGISTRATION_ASSETS_PATH, 'utf8'));
        const match = (onDisk[poolKey] as Array<{ mobile: string; used?: boolean | string }>)
            .find(a => a.mobile === mobile);
        if (match) match.used = used;
        fs.writeFileSync(REGISTRATION_ASSETS_PATH, JSON.stringify(onDisk, null, 2) + '\n');
    } catch (err) {
        console.warn(`[RegistrationHelper] Failed to persist used-flag for ${mobile}: ${err}`);
    }
}

/**
 * Marks a citizen asset as used — tagged with the page it landed on
 * (`products`, `contract`, `nafath`, or `already-registered`) rather than a
 * bare boolean — and persists the flag to data/registrationAssets.json. On
 * UAT these outcomes are permanent dead ends for goToProductsStep — see the
 * project_citizen_asset_pool_exhausted memory — so persisting `used` means
 * later runs skip straight past assets that already cost ~30-45s to
 * discover, instead of rediscovering them from asset #0 every time
 * _citizenIndex resets.
 */
export function markCitizenAssetUsed(mobile: string, page: CitizenAssetOutcome): void {
    const asset = CITIZEN_ASSETS.find(a => a.mobile === mobile);
    if (asset) (asset as { used?: boolean | CitizenAssetOutcome }).used = page;
    persistAssetUsedFlag('assets', mobile, page);
}

/**
 * Marks a resident asset as used — tagged with the outcome it hit in
 * goToFinancialStep (`products` if Business Info resumed straight past
 * Financial, `already-registered` if the backend rejected it outright) —
 * and persists the flag to data/registrationAssets.json, mirroring
 * markCitizenAssetUsed. Without this, nextResidentAsset() had no way to
 * know an asset was already spent — the `used` field existed in the JSON
 * for residents but nothing ever wrote to it, so it stayed `false` forever
 * regardless of live server state.
 */
export function markResidentAssetUsed(mobile: string, outcome: ResidentAssetOutcome): void {
    const asset = RESIDENT_ASSETS.find(a => a.mobile === mobile);
    if (asset) (asset as { used?: boolean | ResidentAssetOutcome }).used = outcome;
    persistAssetUsedFlag('assets', mobile, outcome);
}

/**
 * Splits a pool into a disjoint slice per Playwright worker so concurrent
 * workers (playwright.config.ts runs `workers: 3` locally) never draw the
 * same "next available" asset at the same time and race to submit it —
 * previously nextResidentAsset()/nextCitizenAsset() reset `_residentIndex`/
 * `_citizenIndex` to 0 in every worker process independently, so two workers
 * routinely picked the identical CRN/mobile pair and submitted Business Info
 * for it concurrently, corrupting each other's "reached Financial" checks.
 * Falls back to the full pool when not running inside a test worker (e.g.
 * config.workers is 1 on CI, or the pool is too small to partition).
 */
function getWorkerPartition<T>(pool: T[]): T[] {
    let parallelIndex = 0;
    let totalWorkers = 1;
    try {
        const info = test.info();
        parallelIndex = info.parallelIndex;
        totalWorkers = info.config.workers || 1;
    } catch {
        // Not running inside an active test (e.g. a standalone script) — use the full pool.
    }
    if (totalWorkers <= 1) return pool;
    const slice = pool.filter((_, i) => i % totalWorkers === parallelIndex);
    return slice.length > 0 ? slice : pool;
}

/** Returns the next citizen asset (CRN + National ID + mobile) in round-robin
 *  order. With no `wantOutcome`, skips any asset already flagged `used`
 *  (original behaviour — e.g. NAFATH-step tests want a fresh identity, not
 *  one that already resolved elsewhere). Pass `wantOutcome` when the caller's
 *  goal is a specific landing page (e.g. `goToProductsStep` passes
 *  `'products'`): an asset previously spent landing on that same page resumes
 *  straight back to it, so it's included alongside unused ones — while an
 *  asset flagged for a *different* outcome (e.g. `contract`-flagged when the
 *  goal is `products`) is still skipped, since it would resume to the wrong
 *  page. `wantOutcome` also accepts an array when more than one landing page
 *  is acceptable (e.g. `goToProductsStep`'s `landOnContractOk` — an asset
 *  already flagged `products` or `contract` both resume somewhere useful).
 *  Falls back to the full pool (ignoring the flag) once nothing matches, so
 *  callers never hard-fail — just lose the time-saving skip. */
export function nextCitizenAsset(wantOutcome?: CitizenAssetOutcome | CitizenAssetOutcome[]) {
    const wanted = Array.isArray(wantOutcome) ? wantOutcome : wantOutcome ? [wantOutcome] : [];
    const pool = getWorkerPartition(CITIZEN_ASSETS);
    const available = pool.filter(a => !a.used || wanted.includes(a.used as CitizenAssetOutcome));
    if (available.length === 0) {
        console.warn('[RegistrationHelper] All citizen assets are flagged used — cycling the full pool again.');
        return pool[_citizenIndex++ % pool.length];
    }
    return available[_citizenIndex++ % available.length];
}

/** Returns the next resident asset (CRN + Iqama + mobile), skipping any
 *  asset already flagged `used` — same reasoning as nextCitizenAsset: an
 *  asset that already resumed to Products or was rejected as
 *  already-registered can't reach Financial again. Falls back to the full
 *  pool (ignoring the flag) once nothing matches, so callers never
 *  hard-fail — just lose the time-saving skip.
 *
 *  Picked at random from the available pool rather than walked in order:
 *  a fixed worker partition + sequential index means every run starts at
 *  the same offset and marches forward in the same order, so a contiguous
 *  stretch of assets that are already progressed live on UAT but not yet
 *  flagged locally (e.g. from ad-hoc runs before markResidentAssetUsed
 *  existed) gets hit by every run in lockstep, exhausting goToFinancialStep's
 *  maxAttempts regardless of how high it's set. Random draw decorrelates
 *  attempts from data order so a dead zone in the pool no longer stalls
 *  every run identically.
 */
export function nextResidentAsset() {
    const pool = getWorkerPartition(GENERAL_RESIDENT_ASSETS);
    const available = pool.filter(a => !a.used);
    if (available.length === 0) {
        console.warn('[RegistrationHelper] All resident assets are flagged used — cycling the full pool again.');
        return pool[Math.floor(Math.random() * pool.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
}

/**
 * Returns one resident asset explicitly flagged `used: false` from the
 * reserved DEDICATED_RESIDENT_ASSETS sub-pool — never GENERAL_RESIDENT_ASSETS,
 * which nextResidentAsset() also draws from. For a caller that wants one
 * dedicated, deterministic fresh identity of its own rather than drawing from
 * (and being subject to the worker partitioning, random draw, and
 * maxAttempts retry-cycling of) nextResidentAsset() — e.g. a single test that
 * should own its own mobile outright instead of contending with the rest of
 * the suite for the shared pool. Falls back to nextResidentAsset()'s general
 * pool once the dedicated one is dry, so callers never hard-fail — just lose
 * the isolation guarantee.
 */
export function getFreshResidentAsset() {
    const asset = DEDICATED_RESIDENT_ASSETS.find(a => a.used === false);
    if (asset) return asset;
    console.warn('[RegistrationHelper] getFreshResidentAsset: dedicated pool exhausted — falling back to the general resident pool.');
    return nextResidentAsset();
}

/** Returns the next resident asset from the pool reserved for the "mobile
 *  reused with a different CRN" test (EMI-122 T21) — isolated from
 *  nextResidentAsset()'s pool so that test stops contending with the rest of
 *  the Registration suite for identities during a full bulk run. Same
 *  round-robin + worker-partition + used-flag-skip behaviour as
 *  nextResidentAsset(), just scoped to MOBILE_REUSE_ASSETS. Falls back to
 *  nextResidentAsset()'s much larger general pool once this 30-asset
 *  reservation is dry, rather than cycling back through known-used entries
 *  — same time-saving reasoning as getFreshResidentAsset()'s fallback. */
export function nextMobileReuseResidentAsset() {
    const pool = getWorkerPartition(MOBILE_REUSE_ASSETS);
    const available = pool.filter(a => !a.used);
    if (available.length === 0) {
        console.warn('[RegistrationHelper] All mobile-reuse resident assets are flagged used — falling back to the general resident pool.');
        return nextResidentAsset();
    }
    return available[_mobileReuseIndex++ % available.length];
}

/** Picks a random mobile from the full pre-generated pool. */
export function generateKSAMobile(): string {
    const all = [...CITIZEN_ASSETS, ...RESIDENT_ASSETS];
    return all[Math.floor(Math.random() * all.length)].mobile;
}

// UAT test accounts from phone numbers.xlsx — Sheet1, uat-flagged rows — see data/registrationAssets.json
export const DEV_OTP_ASSETS = registrationAssets.uatOtpAssets;

let _uatOtpIndex = 0;

/** Returns the next UAT OTP test account in round-robin order (phone numbers.xlsx).
 *  Skips any asset already flagged `used` — same reasoning as `nextCitizenAsset`:
 *  a mobile that already went through the OTP flow can land on an
 *  "already registered" state instead of showing the OTP dialog. Falls back to
 *  the full pool once nothing matches so callers never hard-fail. */
export function nextUatOtpAsset() {
    const available = DEV_OTP_ASSETS.filter(a => !a.used);
    if (available.length === 0) {
        console.warn('[RegistrationHelper] All UAT OTP assets are flagged used — cycling the full pool again.');
        return DEV_OTP_ASSETS[_uatOtpIndex++ % DEV_OTP_ASSETS.length];
    }
    return available[_uatOtpIndex++ % available.length];
}

/** Marks a UAT OTP asset used and persists the flag to data/registrationAssets.json,
 *  mirroring `markCitizenAssetUsed`. */
export function markUatOtpAssetUsed(mobile: string): void {
    const asset = DEV_OTP_ASSETS.find(a => a.mobile === mobile);
    if (asset) (asset as { used?: boolean }).used = true;
    persistAssetUsedFlag('uatOtpAssets', mobile, true);
}

/** Picks an unused UAT OTP test mobile from phone numbers.xlsx (see `nextUatOtpAsset`). */
export function generateFreshKSAMobile(): string {
    const available = DEV_OTP_ASSETS.filter(a => !a.used);
    const pool = available.length > 0 ? available : DEV_OTP_ASSETS;
    return pool[Math.floor(Math.random() * pool.length)].mobile;
}


export async function getOtpFromDb(mobile: string, maxAttempts = 10, delayMs = 2000): Promise<string> {
    const env = process.env['ENV'] ?? 'dev';
    // UAT now accepts a fixed all-zero OTP for any mobile, same as dev — no
    // longer limited to the dedicated DEV_OTP_ASSETS pool (see fillOTP's
    // '0'-per-digit fallback for '' below; '000000' behaves identically).
    // Skips the real IMAP/Azure round trip entirely.
    if (env === 'dev' || env === 'uat') return '000000';
    return fetchOtpFromEmail(mobile, maxAttempts, delayMs);
}

export async function fillOTP(page: Page, otp?: string) {
    const inputs = page.getByRole('textbox', { name: 'One time password input' });
    await inputs.first().waitFor({ state: 'visible', timeout: 10000 });
    const count  = await inputs.count();
    for (let i = 0; i < count; i++) {
        await inputs.nth(i).pressSequentially(otp?.[i] ?? '0', { delay: 50 });
    }
}

/**
 * fill() followed by a verifying assertion, retried once. On a step that just
 * transitioned (mobile->OTP->Business Info, or a fresh page load), Angular can
 * still be re-rendering the reactive form when .fill() lands — its bootstrap
 * then silently resets the control back to empty right after, leaving Next
 * permanently disabled and the caller waiting out its full timeout instead of
 * failing fast. See goToInfoStep's mobile-field fix (RegistrationMobilePage)
 * for the same race on the previous step.
 */
async function fillAndVerify(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
    try {
        await expect(locator).toHaveValue(value, { timeout: 3000 });
    } catch {
        await locator.fill(value);
        await expect(locator).toHaveValue(value);
    }
}

export async function goToInfoStep(page: Page, mobile?: string): Promise<void> {
    const usedMobile = mobile ?? generateKSAMobile();
    const mobilePage = new RegistrationMobilePage(page);
    await mobilePage.goto(REGISTER_URL);
    // Clear any in-progress application resumed from a previous identity on this
    // same page/context. The app persists registration state client-side, so a
    // plain re-navigation to REGISTER_URL isn't enough — retry loops that reuse
    // one page across many identities (goToFinancialStep, goToFinancialStepWithDedicatedAsset)
    // were observed resuming the FIRST identity's stuck application on every
    // later attempt regardless of the new mobile/CRN, making every attempt after
    // the first report the same outcome (see the RegistrationFinancialPage.spec.ts
    // hook-timeout failures this fixed — 19-20 consecutive 'products' outcomes
    // drawn from an 86%-fresh pool, statistically impossible without state leakage).
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.context().clearCookies();
    await mobilePage.goto(REGISTER_URL);
    await mobilePage.fillMobile(usedMobile);
    await mobilePage.submitMobile();
    const otpVisible = await page.getByRole('heading', { name: /Enter OTP|أدخل رمز التحقق/i })
        .waitFor({ state: 'visible', timeout: 20000 })
        .then(() => true)
        .catch(() => false);
    if (otpVisible) {
        await page.getByRole('textbox', { name: 'One time password input' }).first()
            .waitFor({ state: 'visible', timeout: 10000 });
        // getOtpFromDb() returns a fixed all-zero OTP in both dev and uat —
        // see its own comment for why the real IMAP/Azure fetch path is
        // skipped entirely for any mobile in either environment now.
        const otp = await getOtpFromDb(usedMobile);
        await fillOTP(page, otp);
        const verifyBtn = page.getByRole('button', { name: /Verify|تحقق/i });
        if (await verifyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await verifyBtn.click();
        }
    }
    await page.getByText(/Tell us about your business|أخبرنا عن نشاطك التجاري/i).waitFor({ state: 'visible', timeout: 60000 });
    await waitForToastClear(page);
}

/**
 * Clicks Business Info's Next button while racing the network response for
 * the profile-registration-type submission it triggers, and reports whether
 * that submission was rejected as a conflict.
 *
 * Confirmed live via network capture: a mobile/CRN/National-ID combination
 * the backend already considers registered returns a 409 on
 * `POST .../register/profile-registration-type` with NO visible on-page
 * error text or toast — isAlreadyRegisteredMessage() (which only scans
 * rendered page text) can never catch this case. Every climb loop in this
 * file that calls infoPage.nextButton.click() directly instead of through
 * this helper shares that same blind spot: it silently treats an
 * already-registered pool asset as a mysterious dead end (financial/
 * verification never load, outcome races time out) rather than cycling to
 * the next asset the way the isAlreadyRegisteredMessage() path already does.
 * This was the real cause behind RegistrationNafathFunctionality.spec.ts (and
 * its ui/RegistrationNafathPage.spec.ts sibling, which shares the same
 * un-fixed blind spot) repeatedly exhausting a single "fresh" pool asset
 * without ever detecting why.
 */
export async function submitBusinessInfo(
    page: Page,
    infoPage: RegistrationInfoPage
): Promise<{ conflict: boolean }> {
    const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/register/profile-registration-type'), { timeout: 15000 }).catch(() => null),
        infoPage.nextButton.click(),
    ]);
    return { conflict: response?.status() === 409 };
}

export interface FinancialStepCredentials {
    mobile?: string;
    crn?: string;
    nationalId?: string;
    profileType?: 'individual' | 'merchant';
    email?: string;
}

/**
 * True when the page shows a "this identity is already registered" style
 * rejection. The CRN/National ID pools in this file are shared and reused
 * (round-robin) across every test run, so an asset ending up already
 * registered — because a prior run completed a full sign-up with it — is
 * expected steady-state, not a failure.
 */
export function isAlreadyRegisteredMessage(text: string | null | undefined): boolean {
    if (!text) return false;
    // The app defaults to Arabic, so the rejection is usually seen as e.g.
    // "الملف الشخصي موجود بالفعل." (profile already exists) rather than English.
    return /already\s*(registered|exists|have an account|in use|associated)|duplicate\s*(registration|account|profile)?/i.test(text)
        || /موجود\s*بالفعل|مسجل\s*(مسبقا|مسبقاً|بالفعل)|مكرر/.test(text);
}

export async function goToFinancialStep(page: Page, credentials?: FinancialStepCredentials): Promise<void> {
    // Only the default round-robin pool is safe to retry across — an explicit
    // crn/nationalId means the caller is deliberately testing a specific
    // (often intentionally invalid) identity and must not be silently swapped.
    //
    // Capped well below the worker's partition size on purpose: this used to be
    // RESIDENT_ASSETS.length (the full *unpartitioned* 2000-asset pool), while
    // nextResidentAsset() only ever draws from this worker's much smaller slice
    // of it. That mismatch meant a run of already-registered/already-progressed
    // assets (expected steady-state on a shared pool — see isAlreadyRegisteredMessage
    // above) could burn ~20-30s per rejected attempt for up to 2000 iterations —
    // functionally an infinite loop that never reaches the test body. Per the
    // project's own conclusion elsewhere (see the pool-exhaustion errors below):
    // cycling indefinitely isn't the fix — fail fast with a clear diagnostic.
    // NOTE: as of 2026-08-23 the front of this pool has 149+ consecutive assets
    // already flagged 'products' (confirmed via data/registrationAssets.json) —
    // already-known-used assets are skipped for free, but a run can still hit this
    // cap on newly-discovered ones within that streak. If exhaustion errors persist,
    // the fix is refreshing the pool per the error's own message, not raising this
    // number further.
    const usingDefaultIdentity = !credentials?.crn && !credentials?.nationalId;
    const maxAttempts = usingDefaultIdentity ? Math.min(getWorkerPartition(GENERAL_RESIDENT_ASSETS).length, 10) : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const asset = nextResidentAsset();
        const mobile     = credentials?.mobile     ?? asset.mobile;
        const crn        = credentials?.crn        ?? asset.crn;
        const nationalId = credentials?.nationalId ?? asset.nationalId;
        const profileType = credentials?.profileType ?? 'individual';

        // The retry loop below can legitimately take several minutes across
        // maxAttempts (each a full mobile->OTP->Business Info round trip) — with
        // no visible output, a multi-attempt run is indistinguishable from a hang.
        console.log(`[goToFinancialStep] attempt ${attempt}/${maxAttempts} — mobile=${mobile}`);

        await goToInfoStep(page, mobile);

        const infoPage = new RegistrationInfoPage(page);
        if (profileType === 'merchant') {
            // Accessible name is Arabic-only ("تاجر") when the app defaults to Arabic, so a
            // name-based locator can't find it — infoPage.merchantButton is an id selector,
            // stable across languages.
            await infoPage.merchantButton.click();
        } else {
            // The profile-type radiogroup now only has two cards: Merchant (index 0,
            // pre-selected by default) and Freelancer (index 1, disabled/"coming soon").
            // .first() reliably lands on Merchant — there's no separate individual/
            // resident option in the UI anymore.
            await infoPage.profileTypeGroup.getByRole('radio').first().click();
        }

        await fillAndVerify(infoPage.crnInput, crn);
        await fillAndVerify(infoPage.idInput, nationalId);
        await fillAndVerify(infoPage.emailInput, credentials?.email ?? generateEmail());
        await infoPage.nextButton.click();

        const financialPage = new RegistrationFinancialPage(page);
        await financialPage.loadingButton.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
        const products = new RegistrationProductsPage(page);
        // Races against products.productCards (.mp-product-card), not
        // products.formSubTitle (.form-sub-title) — that class is shared by
        // every wizard step's header, including Financial & Business' own
        // subtitle, so racing it against monthlyBillsInput produced a false
        // 'products' read on nearly every attempt regardless of which step
        // actually loaded (confirmed live: a run's failure snapshot showed the
        // browser genuinely sitting on the Financial form after being
        // misdetected as 'products' moments earlier). productCards only
        // renders on the real Products step.
        const outcome = await Promise.race([
            financialPage.monthlyBillsInput.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'financial' as const),
            products.productCards.first().waitFor({ state: 'visible', timeout: 20000 }).then(() => 'products' as const),
        ]).catch(() => 'neither' as const);
        console.log(`[goToFinancialStep] attempt ${attempt}/${maxAttempts} — outcome=${outcome}`);
        if (outcome === 'financial') return;

        if (usingDefaultIdentity && outcome === 'products') {
            // Shared/reused pool asset had already progressed past Business Info
            // (straight to Products) in a prior run — expected steady-state for
            // this pool, same as the already-registered case below. Persist so
            // future runs skip it via nextResidentAsset() instead of rediscovering it.
            markResidentAssetUsed(mobile, 'products');
            if (attempt < maxAttempts) continue;
            // Every asset in the pool has now progressed past Business Info — this is
            // pool exhaustion, not a backend rejection. Thrown separately from the
            // generic error below so callers aren't misled into debugging a
            // nonexistent regression (the page shows Products, not a rejection).
            throw new Error(
                `goToFinancialStep: exhausted all ${maxAttempts} RESIDENT_ASSETS — every pool asset has ` +
                `already progressed past Business Info straight to Products. Add fresh assets to ` +
                `RESIDENT_ASSETS or free up ones marked 'products' in data/registrationAssets.json.`
            );
        }

        if (outcome === 'products') {
            // Explicit (non-default) identity — the caller passed a specific
            // mobile/crn/nationalId, so there's no pool to cycle through (see
            // maxAttempts above). The page resumed straight to Products, which
            // is a legitimate prior-progress state, not a backend rejection —
            // thrown separately so callers aren't misled by the generic
            // "rejected by the backend" error below into debugging a
            // nonexistent validation failure.
            throw new AssetAlreadyProgressedError(
                `goToFinancialStep: identity already progressed past Business Info straight to ` +
                `Products (not a backend rejection). CRN=${crn}, ID=${nationalId}, Mobile=${mobile}.`
            );
        }

        const errorMsg = await page.evaluate(() => document.body.innerText).catch(() => '(unknown)');

        if (usingDefaultIdentity && isAlreadyRegisteredMessage(errorMsg)) {
            // Valid, expected outcome for a shared/reused pool asset — persist and try the next one.
            markResidentAssetUsed(mobile, 'already-registered');
            if (attempt < maxAttempts) continue;
            // Every asset in the pool is already registered — pool exhaustion, not a
            // fresh backend rejection worth investigating as a regression.
            throw new Error(
                `goToFinancialStep: exhausted all ${maxAttempts} RESIDENT_ASSETS — every pool asset is ` +
                `already registered. Add fresh assets to RESIDENT_ASSETS.`
            );
        }

        throw new Error(
            `Business Info step was rejected by the backend` +
            (usingDefaultIdentity ? ` after ${attempt} attempt(s)` : '') + `.\n` +
            `CRN=${crn}, ID=${nationalId}, Mobile=${mobile}.\n` +
            `Page text: ${errorMsg?.slice(0, 300)}`
        );
    }
}

/**
 * Drives goToFinancialStep for a caller that wants one dedicated identity of
 * its own (see getFreshResidentAsset), retrying across the reserved
 * DEDICATED_RESIDENT_ASSETS pool if a given asset turns out to have already
 * progressed past Business Info. That pool predates full used-flag tracking
 * (see markResidentAssetUsed) — a `used:false` entry can still turn out to
 * already be spent on the live UAT backend — so a single fixed pick isn't
 * reliable even when it's the only caller that ever draws it.
 *
 * Re-derives the available (used:false) set fresh on every attempt — rather
 * than filtering once up front and walking the result in order — so each
 * pick reflects every mark made so far this run (including ones just made
 * this loop) before it's attempted, and picks randomly among what's left
 * rather than sequentially, so a stale stretch in the pool doesn't get
 * walked in the same order attempt after attempt. Marks each discovered-stale
 * asset 'products' as it's found so later runs skip it too.
 *
 * Capped at 20 attempts rather than the full (60-asset) pool: live checks
 * have turned up a real stale rate well above what the local used:false
 * flags suggest (a pre-run check of this pool counted 12/60 already
 * 'products' — the same run then discovered 4 more among the 48 it thought
 * were fresh). Genuinely walking all 60 would be ~20-30 min of real UAT
 * round trips per test run. If 20 isn't enough, the fix is refreshing this
 * dataset against live backend state, not raising the cap further — see the
 * project's own conclusion on the shared pool for the same reasoning.
 *
 * Bails out of the dedicated pool early (DEDICATED_FALLBACK_THRESHOLD
 * consecutive already-progressed hits) rather than spending all maxAttempts
 * inside it: a run confirmed 18/60 dedicated assets already-progressed in a
 * single pass, and a bad random draw can chain enough of that stale 30% back
 * to back to burn the whole beforeEach timeout before ever reaching a fresh
 * one — see the RegistrationFinancialPage.spec.ts hook-timeout failure this
 * fixed. GENERAL_RESIDENT_ASSETS (nextResidentAsset()'s pool, ~900+ assets)
 * is checked flag-first the same way and is large enough that a fresh draw
 * is far more likely on the first try, so falling back there for the
 * remaining attempts trades a little of this pool's isolation guarantee for
 * a bounded worst-case runtime.
 */
const DEDICATED_FALLBACK_THRESHOLD = 5;

// If this many attempts IN A ROW land on 'products' — spanning BOTH the
// dedicated pool and (after DEDICATED_FALLBACK_THRESHOLD) the general pool —
// bail out rather than burning the rest of maxAttempts / the 600s hook
// timeout. Originally added chasing what looked like systemic pool
// exhaustion (every run producing 16-20/20 straight 'products' outcomes,
// unaffected by clearing localStorage/cookies) — the real cause turned out
// to be goToFinancialStep's outcome race matching products.formSubTitle
// (.form-sub-title), a class shared by every wizard step's own header
// including Financial's, so it false-won the race almost every attempt
// regardless of which step actually loaded (fixed: races productCards
// instead, which only renders on the real Products step). Kept as a
// defensive cap for genuine pool exhaustion now that the false-positive
// source is gone.
const SYSTEMIC_FAILURE_THRESHOLD = 8;

export async function goToFinancialStepWithDedicatedAsset(page: Page): Promise<void> {
    const maxAttempts = Math.min(DEDICATED_RESIDENT_ASSETS.length, 20);
    let dedicatedFailures = 0;
    let totalFailures = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (totalFailures >= SYSTEMIC_FAILURE_THRESHOLD) {
            throw new Error(
                `goToFinancialStepWithDedicatedAsset: ${totalFailures} consecutive attempts across both the ` +
                `dedicated and general pools landed on Products — genuine pool exhaustion across both a small ` +
                `reserved pool and the much larger general pool simultaneously is very unlikely. If this fires ` +
                `again after a fresh DEDICATED_RESIDENT_ASSETS pool, re-check goToFinancialStep's outcome race ` +
                `for another false-positive 'products' match before assuming the pool is exhausted.`
            );
        }
        const dedicatedAvailable = DEDICATED_RESIDENT_ASSETS.filter(a => !a.used);
        const useFallbackPool = dedicatedFailures >= DEDICATED_FALLBACK_THRESHOLD || dedicatedAvailable.length === 0;
        const asset = useFallbackPool ? nextResidentAsset() : dedicatedAvailable[Math.floor(Math.random() * dedicatedAvailable.length)];
        console.log(`[goToFinancialStepWithDedicatedAsset] attempt ${attempt}/${maxAttempts} — mobile=${asset.mobile}${useFallbackPool ? ' (general pool fallback)' : ''}`);
        try {
            await goToFinancialStep(page, { mobile: asset.mobile, crn: asset.crn, nationalId: asset.nationalId });
            return;
        } catch (err) {
            if (err instanceof AssetAlreadyProgressedError) {
                markResidentAssetUsed(asset.mobile, 'products');
                if (!useFallbackPool) dedicatedFailures++;
                totalFailures++;
                if (attempt < maxAttempts) continue;
                throw new Error(
                    `goToFinancialStepWithDedicatedAsset: exhausted ${maxAttempts} attempts — every asset tried ` +
                    `had already progressed past Business Info. Refresh DEDICATED_RESIDENT_ASSETS' underlying ` +
                    `data or raise DEDICATED_ASSET_POOL_SIZE.`
                );
            }
            throw err;
        }
    }
}



export async function goToVerificationStep(page: Page): Promise<void> {
    await goToFinancialStep(page);
    const financialPage = new RegistrationFinancialPage(page);
    await financialPage.fill('1500', '50000', '10000', '20000');

    // Only Industries (index 0) and Annual Income (index 1) render on this
    // step — there is no separate Banks select to fill.
    await selectRandomOption(page, page.locator('#mat-select-value-0'));
    await selectRandomOption(page, page.locator('#mat-select-value-1'));

    await financialPage.next();
    const verificationPage = new RegistrationVerificationPage(page);
    await verificationPage.waitForLoad();
}

export async function fillFinancialForm(page: Page): Promise<void> {
    const financialPage = new RegistrationFinancialPage(page);
    await financialPage.fill('1500', '50000', '10000', '20000');

    // Only Industries (index 0) and Annual Income (index 1) render on this
    // step — there is no separate Banks select to fill.
    await selectRandomOption(page, page.locator('#mat-select-value-0'));
    await selectRandomOption(page, page.locator('#mat-select-value-1'));
}

/** Fills the Verification & Uploads step (Tab 3): bank, IBAN, VAT number, and
 *  every file-upload input on the panel. Does not submit — callers click
 *  signUpButton themselves once the form is filled. */
export async function fillVerificationForm(page: Page): Promise<void> {
    const verificationPage = new RegistrationVerificationPage(page);
    await verificationPage.waitForLoad();

    if (await verificationPage.bankDropdown.count() > 0) {
        await selectRandomOption(page, verificationPage.bankDropdown.first());
    }
    await verificationPage.ibanInput.fill(VALID_IBAN);
    await verificationPage.vatInput.fill(VALID_VAT_NUMBER);

    const fileInputs = page.locator('input[type="file"]');
    const fileInputCount = await fileInputs.count();
    for (let i = 0; i < fileInputCount; i++) {
        const fileName = `doc${i}.pdf`;
        await fileInputs.nth(i)
            .setInputFiles({ name: fileName, mimeType: 'application/pdf', buffer: TEST_FILE_BUFFER })
            .catch(() => {});
        // Confirmed live (RegistrationVerificationUploads.spec.ts): setInputFiles()
        // resolves once the DOM input holds the file, NOT once the app's own
        // async upload finishes — callers clicking Sign Up right after this loop
        // used to race that upload and find it still disabled. Wait for each
        // filename to actually render (the app's own "Uploaded" confirmation)
        // before moving on, same fix already applied at that call site.
        await page.getByText(fileName).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }
}

/**
 * Drives the registration wizard forward until it lands on the outer Products
 * step (step 3 of 4), cycling to a new CITIZEN_ASSETS mobile whenever the
 * current one resumes past Products instead — onto Contract. CITIZEN_ASSETS is
 * a shared, reused pool, so a mobile resuming mid-flow is expected steady-state,
 * not a failure: Financial & Business and Verification & Uploads are filled
 * through with fillFinancialForm()/fillVerificationForm() whenever they appear
 * along the way, in case a given mobile pauses there instead of at
 * Products/Contract/NAFATH.
 *
 * Races Products/Contract/NAFATH in one bounded wait per attempt rather than
 * waiting on Products alone first — a mobile that resumes straight to Contract
 * would otherwise burn a long Products-only timeout before anyone noticed it
 * wasn't going to appear.
 *
 * Hitting the real NAFATH panel is not a dead end: its Verify button starts
 * disabled and enables once the ~20s redirect countdown expires (EMI-4895/
 * EMI-4937), so we wait that out and click it — the happy path in this
 * environment — before checking whether Products (or Contract) followed.
 *
 * Returns true once Products is reached, false if maxAttempts is exhausted
 * without landing there.
 *
 * `landOnContractOk` — when true, a mobile that resumes straight past Products
 * to Contract counts as success too (returns true immediately) instead of being
 * discarded and cycled past. goToContractStep() passes this since Contract is
 * its actual target anyway; skipping the extra full registration attempt saves
 * ~30-45s per asset that would otherwise be wasted only to re-derive the same
 * destination. Other callers (which specifically need the Products panel) leave
 * this false.
 */
/**
 * The mobile number of whichever CITIZEN_ASSETS entry `goToProductsStep`
 * most recently succeeded with — set on every loop iteration, not just on
 * return, so it's already correct by the time any of that function's several
 * `return true` points fires. Exposed as a side-channel (`lastReachedAssetMobile`)
 * rather than added to `goToProductsStep`'s own return value: that value is a
 * bare boolean asserted directly (`expect(reachedProducts).toBe(true)`) by six
 * other call sites across this suite, so widening it to an object would break
 * every one of them. A caller that needs to know which identity was actually
 * used (e.g. to look its record up afterward in the database) reads this
 * immediately after `goToProductsStep`/`goToContractStep` resolves.
 */
let lastReachedAssetMobile: string | null = null;
export function lastReachedCitizenAssetMobile(): string | null {
    return lastReachedAssetMobile;
}

export async function goToProductsStep(page: Page, maxAttempts = 10, landOnContractOk = false): Promise<boolean> {
    const products = new RegistrationProductsPage(page);
    // Scoped to products.productCards (.mp-product-card), not products.formSubTitle
    // (.form-sub-title) — that class is shared by every wizard step's own header,
    // including Business Info's, so racing it below could false-win as 'products'
    // if the flow unexpectedly lands back on an earlier step instead (confirmed
    // live: a RegistrationProductsPage.spec.ts run read Business Info's own title
    // ("أخبرنا عن نشاطك التجاري") through this same shared-class hole — see the
    // identical fix in goToFinancialStep's outcome race). productCards only
    // renders on the real Products step. A raw page.getByText() text search isn't
    // an option either — it's ambiguous on this app (likely an Angular CDK a11y
    // live-announcer duplicate of the same string elsewhere in the DOM), which
    // throws a strict-mode violation that Promise.race's .catch() below silently
    // swallows as 'neither', even when Products has clearly rendered.
    const productsHeading = products.productCards.first();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // When landing on Contract is an acceptable outcome (goToContractStep's
        // actual target), also reuse assets already flagged `contract` — they
        // resume straight there, same as `products`-flagged ones do for the
        // Products-only callers. Without this, goToContractStep could never
        // reuse its own previously-discovered fast path and had to burn a full
        // fresh registration attempt (risking a real NAFATH dead end) every time.
        const asset = nextCitizenAsset(landOnContractOk ? ['products', 'contract'] : 'products');
        lastReachedAssetMobile = asset.mobile;
        console.log(`[goToProductsStep] attempt ${attempt}/${maxAttempts} — mobile ${asset.mobile} (used=${(asset as { used?: unknown }).used ?? 'unused'})`);
        await goToInfoStep(page, asset.mobile);

        const infoPage = new RegistrationInfoPage(page);
        await infoPage.profileTypeGroup.getByRole('radio').first().click();
        await fillAndVerify(infoPage.crnInput, asset.crn);
        await fillAndVerify(infoPage.idInput, asset.nationalId);
        await fillAndVerify(infoPage.emailInput, generateEmail());
        await infoPage.nextButton.click();
        await page.getByRole('button', { name: /Loading|جاري التحميل/i })
            .waitFor({ state: 'hidden', timeout: 20000 })
            .catch(() => {});

        // Check for an "already registered" rejection right away — it renders as a
        // toast that auto-dismisses within seconds, so it must be read before sinking
        // ~50s into the Financial/Verification/Contract/NAFATH waits below, by which
        // point it would have already disappeared from document.body.innerText.
        const infoStepText = await page.evaluate(() => document.body.innerText).catch(() => '');
        if (isAlreadyRegisteredMessage(infoStepText)) {
            markCitizenAssetUsed(asset.mobile, 'already-registered');
            continue;
        }

        const financialPage = new RegistrationFinancialPage(page);
        const reachedFinancial = await financialPage.monthlyBillsInput
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true)
            .catch(() => false);

        if (reachedFinancial) {
            await fillFinancialForm(page);
            await financialPage.next();
        }

        const verificationPage = new RegistrationVerificationPage(page);
        const reachedVerification = await verificationPage.ibanInput
            .waitFor({ state: 'visible', timeout: 15000 })
            .then(() => true)
            .catch(() => false);

        if (reachedVerification) {
            await fillVerificationForm(page);
            await verificationPage.signUpButton.click();
            await page.getByRole('button', { name: /Loading|جاري التحميل/i })
                .waitFor({ state: 'hidden', timeout: 20000 })
                .catch(() => {});
        }

        const contractStep = products.activeStep.filter({ hasText: 'العقد' });
        const nafathPage = new RegistrationNafathPage(page);

        const landedOn = await Promise.race([
            productsHeading.waitFor({ state: 'visible', timeout: 40000 }).then(() => 'products' as const),
            contractStep.waitFor({ state: 'visible', timeout: 40000 }).then(() => 'contract' as const),
            nafathPage.nafathHeading.waitFor({ state: 'visible', timeout: 40000 }).then(() => 'nafath' as const),
        ]).catch(() => 'neither' as const);
        console.log(`[goToProductsStep] attempt ${attempt} landed on: ${landedOn}`);

        if (landedOn === 'products') {
            // Confirmed live: an asset whose product selection was already submitted
            // in an earlier run (e.g. driven through goToContractStep's Products
            // Continue button) renders the Products heading only as a brief flicker
            // before the app auto-advances it to Contract on its own — the race
            // above can catch that flicker and misreport 'products' for an asset
            // that's actually already past it (confirmed via DOM dump: the "landed
            // on products" page.content() was byte-identical to a Contract-page
            // dump). Give reused `products`-flagged assets a short settle window to
            // rule that out before trusting the landing; skip it for brand-new
            // assets, which can't have this history yet and would otherwise pay a
            // pure timeout tax on every single successful landing.
            const isReusedAsset = asset.used === 'products';
            if (isReusedAsset) {
                const advancedToContract = await contractStep.waitFor({ state: 'visible', timeout: 5000 })
                    .then(() => true)
                    .catch(() => false);
                if (advancedToContract) {
                    console.log(`[goToProductsStep] attempt ${attempt} — 'products' was a flicker, actually already on contract`);
                    markCitizenAssetUsed(asset.mobile, 'contract');
                    if (landOnContractOk) return true;
                    continue;
                }
            }
            markCitizenAssetUsed(asset.mobile, 'products');
            return true;
        }
        if (landedOn === 'contract') {
            markCitizenAssetUsed(asset.mobile, 'contract');
            if (landOnContractOk) return true;
            continue;
        }

        if (landedOn === 'nafath') {
            // Reaching real NAFATH is itself a dead end for automation (it requires
            // biometric verification), so this identity is spent for future runs
            // regardless of what the click below does — mark it now.
            markCitizenAssetUsed(asset.mobile, 'nafath');

            // Happy path: the Verify button starts disabled and only enables once
            // the ~20s redirect countdown expires (EMI-4895, duration fixed by
            // EMI-4937 — see RegistrationNafathFunctionality.spec.ts). Playwright's
            // click() already waits for the target to become enabled as part of its
            // actionability checks, so no manual polling of the countdown is needed.
            console.log(`[goToProductsStep] attempt ${attempt} hit NAFATH — clicking Verify`);
            const verified = await nafathPage.verifyButton.click({ timeout: 30000 }).then(() => true).catch(() => false);
            console.log(`[goToProductsStep] attempt ${attempt} NAFATH verify click ${verified ? 'succeeded' : 'failed'}`);
            if (!verified) continue;

            const postNafathLandedOn = await Promise.race([
                productsHeading.waitFor({ state: 'visible', timeout: 40000 }).then(() => 'products' as const),
                contractStep.waitFor({ state: 'visible', timeout: 40000 }).then(() => 'contract' as const),
            ]).catch(() => 'neither' as const);
            console.log(`[goToProductsStep] attempt ${attempt} post-NAFATH landed on: ${postNafathLandedOn}`);

            if (postNafathLandedOn === 'products') return true;
            if (postNafathLandedOn === 'contract') {
                if (landOnContractOk) return true;
                continue;
            }

            // Neither Products nor Contract appeared after a successful NAFATH
            // verify — most likely an "already registered" rejection with no
            // recognizable panel, same as the outer 'neither' check below. Only
            // cycle when that's confirmed; otherwise this is a genuine
            // post-NAFATH regression, so fail fast instead of burning the rest
            // of maxAttempts retrying blindly.
            const postNafathText = await page.evaluate(() => document.body.innerText).catch(() => '');
            if (!isAlreadyRegisteredMessage(postNafathText)) return false;
            continue;
        }

        // Neither Products, Contract, nor NAFATH appeared — most likely an
        // "already registered" rejection with no recognizable panel, but could
        // also just be a slow-loading attempt on this one asset. Either way,
        // cycle to the next asset instead of treating a single inconclusive
        // attempt as an unexpected failure — maxAttempts already bounds the
        // whole climb, and the final `return false` after the loop covers
        // genuine exhaustion. (Previously this returned false immediately for
        // the non-already-registered case, contradicting this very comment and
        // giving up after a single attempt instead of using the other 9 — see
        // the RegistrationProductsPage.spec.ts beforeAll failure this fixed.)
        const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
        if (isAlreadyRegisteredMessage(pageText)) {
            markCitizenAssetUsed(asset.mobile, 'already-registered');
        } else {
            console.log(`[goToProductsStep] attempt ${attempt} — landed on neither Products/Contract/NAFATH and no already-registered message; cycling to the next asset.`);
        }
    }
    return false;
}

/**
 * Drives the wizard to the Contract step: reaches Products via goToProductsStep,
 * then clicks its Continue button — confirmed live to skip the PoS sub-flow
 * straight to Contract when the "Request devices now" checkbox is left
 * unchecked (see RegistrationProductsPage's skipSetupLaterButton comment).
 * Throws if Products was never reached (goToProductsStep exhausted its
 * attempts) rather than silently landing nowhere.
 *
 * Returns the mobile number of the identity that actually got there — every
 * existing caller was a bare `await goToContractStep(page);` with the prior
 * `Promise<void>` return discarded, so returning this instead is not a
 * breaking change. Lets a caller look up that identity's own record
 * afterward (e.g. in emi_profile's SQL tables) without having to guess which
 * of the CITIZEN_ASSETS pool's ~2000 entries goToProductsStep landed on.
 */
export async function goToContractStep(page: Page): Promise<string> {
    const reachedProducts = await goToProductsStep(page, 10, true);
    if (!reachedProducts) {
        throw new Error('Could not reach the Products step, so the Contract step is unreachable.');
    }
    const mobile = lastReachedCitizenAssetMobile();
    if (!mobile) {
        throw new Error('goToProductsStep reported success but recorded no identity — lastReachedCitizenAssetMobile() was never set.');
    }

    const contractPage = new RegistrationContractPage(page);
    const products = new RegistrationProductsPage(page);
    // landOnContractOk means goToProductsStep may have already resolved straight
    // onto Contract (mobile resumed past Products) — only click through Products'
    // Continue button when we're actually still on it. A one-shot isVisible()
    // check here raced the page: a `products`-landed asset that had already
    // completed the PoS step on a prior run auto-advances off Products on its
    // own, so by the time isVisible() ran neither the Contract heading nor the
    // Products Continue button was necessarily up yet, and the click below would
    // wait 20s for a button that had already been swept off the page. Racing the
    // two locators (each with its own bounded wait) instead of a single instant
    // snapshot lets whichever one actually renders win.
    // skipSetupLaterButton (testid register-products-continue-btn) is the
    // confirmed Products-step Continue control — products.continueButton is
    // ambiguous with the Devices & Delivery panel's own "متابعة" button.
    const initialState = await Promise.race([
        contractPage.agreementHeading.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'contract' as const),
        products.skipSetupLaterButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'products' as const),
    ]).catch(() => 'neither' as const);
    console.log(`[goToContractStep] initial state: ${initialState}`);

    if (initialState === 'products') {
        console.log('[goToContractStep] clicking Products skipSetupLaterButton to advance to Contract');
        await products.skipSetupLaterButton.click({ timeout: 20000 }).catch(() => {
            console.log('[goToContractStep] skipSetupLaterButton click failed/no-op — button may have already been swept off the page; falling through to waitForLoad');
        });
        console.log('[goToContractStep] skipSetupLaterButton click resolved');
    }

    console.log('[goToContractStep] waiting for contract agreementHeading to render');
    await contractPage.waitForLoad();
    console.log('[goToContractStep] contract page loaded');
    return mobile;
}

/**
 * From the Products step (after goToProductsStep resolves true), expands the
 * PoS Terminals card and reports whether its inline "Request devices now" /
 * "Skip - set up later" sub-flow is available. A citizen asset that already
 * completed the PoS sub-flow in a prior run (shared CITIZEN_ASSETS pool)
 * advances straight to Contract instead of expanding — that's expected
 * steady-state, not a failure, so this returns false rather than throwing.
 * Returns false without clicking anything if the "POS" card isn't found at all.
 */
export async function expandPosCard(page: Page): Promise<boolean> {
    const products = new RegistrationProductsPage(page);
    const posCard = products.productCard('POS');
    const posCardFound = await posCard
        .waitFor({ state: 'visible', timeout: 10000 })
        .then(() => true)
        .catch(() => false);
    if (!posCardFound) return false;

    await posCard.click({ timeout: 10000 });
    const contractStep = products.activeStep.filter({ hasText: 'العقد' });
    return await Promise.race([
        products.requestDevicesNowButton.waitFor({ state: 'visible', timeout: 8000 }).then(() => true),
        contractStep.waitFor({ state: 'visible', timeout: 8000 }).then(() => false),
    ]).catch(() => false);
}

/**
 * Drives the inline PoS "Request devices now" sub-flow (from an expanded
 * card confirmed via expandPosCard()) through to a submittable Devices &
 * Delivery form: checks Request-now, continues past the card, fills device
 * count and contact fields, then waits for the Wathiq national address to
 * finish resolving before returning.
 *
 * That last wait matters: pos-delivery-editor-wathiq-refresh-btn-0 only
 * renders once the address fetch completes, and submitting
 * (register-pos-delivery-submit-btn) while it's still resolving silently
 * no-ops instead of advancing to Review — confirmed live via probe. The
 * caller still needs to click devicesDeliveryNextButton itself; this only
 * gets the form into a submittable state.
 */
export async function fillPosDevicesDeliveryForm(
    page: Page,
    options?: { deviceCount?: string; contactName?: string; contactMobile?: string }
): Promise<void> {
    const products = new RegistrationProductsPage(page);
    await products.requestDevicesNowButton.click();
    await products.skipSetupLaterButton.click();
    await products.deviceCountInput.waitFor({ state: 'visible', timeout: 10000 });

    await products.deviceCountInput.fill(options?.deviceCount ?? '1');
    await products.updateWathiqAddressButton.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    await products.contactNameInput.fill(options?.contactName ?? 'Test Contact');
    await products.contactMobileInput.fill(options?.contactMobile ?? '512345678');
}

/**
 * Route-mocking helpers for the Sprint 71 registration items (section 13 of
 * the test-case doc): auto-approval/auto-activation (EMI-5748), fixed-Merchant
 * sign-up mode (EMI-5768), and activation email (EMI-5777).
 *
 * None of these endpoints are given verbatim in the ticket text (unlike the
 * PoS section), so the paths below are best-effort guesses following this
 * app's existing `/emi-profile/api/v1/...` convention — reconcile against the
 * real network tab on first live run, same caveat as RegistrationProductsPage.ts.
 */

/** Toggles the EMI-5768 fixed-Merchant sign-up mode config the registration
 *  wizard is expected to read before rendering the profile-type step. */
export async function mockFixedMerchantMode(page: Page, enabled: boolean): Promise<void> {
    await page.route('**/*registration*settings*', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fixedMerchantMode: enabled }) })
    );
}

/** Mocks the final registration submission so the response reflects
 *  auto-approval + auto-activation (EMI-5748) instead of a "pending review"
 *  status, and includes an activation-email-sent flag (EMI-5777). */
export async function mockAutoApprovedRegistration(page: Page): Promise<void> {
    await page.route('**/emi-profile/api/v1/register/**', route => {
        if (route.request().method() !== 'POST') return route.continue();
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ACTIVE', approvalStatus: 'APPROVED', activationEmailSent: true }),
        });
    });
}

export async function selectRandomOption(page: Page, dropdownLocator: Locator) {
    const tag = await dropdownLocator.evaluate((el: Element) => el.tagName.toLowerCase());
    if (tag === 'select') {
        const options    = await dropdownLocator.locator('option').all();
        const selectable = options.slice(1);
        const pick       = selectable[Math.floor(Math.random() * selectable.length)];
        await dropdownLocator.selectOption(await pick.getAttribute('value'));
    } else {
        await dropdownLocator.click();
        const items = page.locator(
            '[role="option"]:visible:not([aria-disabled="true"]):not([disabled]), ' +
            '.dropdown-item:visible:not([aria-disabled="true"]):not([disabled]), ' +
            '.ng-option:visible:not([aria-disabled="true"]):not([disabled])'
        );
        await items.first().waitFor({ state: 'visible', timeout: 5000 });
        const count = await items.count();
        await items.nth(Math.floor(Math.random() * count)).click();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL Server (emi_profile.*) — direct DB assertions for the account a
// registration run actually produced, independent of what the UI itself goes
// on to render. Schema and table names confirmed live 2026-09-27 by
// cross-referencing a real completed registration (goToContractStep + Contract
// submission) against these exact tables, not guessed. See
// support/sqlServerClient.ts for the connection itself and TopupHelper.ts for
// the identical pattern this mirrors on the Topup side.
//
// `business_profile_registration_requests.created_at` is NOT when a given run
// used that identity — CITIZEN_ASSETS is a shared, reused pool (confirmed
// live: a row completed by today's run still carried a `created_at` from
// three months earlier), so every query below orders by `last_modified_at`
// instead, which does update on reuse.

export interface RegistrationProfileRow {
    id: string;
    created_at: string;
    email: string;
    mobile_number: string;
    tenant_number: string;
    profile_code: string;
    identity_number: string;
    is_active: boolean;
    is_approved: boolean;
    is_blocked: boolean;
    is_email_verified: boolean;
    is_test_user: boolean;
}

/** Reads the `profiles` row for a mobile number straight from emi_profile — the actual provisioned account, not the in-progress registration request. */
export async function getRegistrationProfileByMobileFromSql(mobileNumber: string): Promise<RegistrationProfileRow | null> {
    const pool = await getSqlPool();
    const result = await pool.request()
        .input('mobile', mobileNumber)
        .query(`
            USE [emi_profile];
            SELECT TOP 1 id, created_at, email, mobile_number, tenant_number, profile_code, identity_number,
                   is_active, is_approved, is_blocked, is_email_verified, is_test_user
            FROM profiles
            WHERE mobile_number = @mobile
            ORDER BY created_at DESC;
        `);
    return (result.recordset[0] as RegistrationProfileRow) ?? null;
}

export interface BusinessProfileRegistrationRequestRow {
    id: string;
    created_at: string;
    last_modified_at: string;
    mobile_number: string;
    email: string | null;
    crn: string | null;
    profile_code: string;
    is_completed_form: boolean;
    is_mobile_owner_ship_verified: boolean;
    is_wathiq_info_completed: boolean;
    is_get_nafath_status_completed: boolean;
    is_product_assigned: boolean;
    is_contract_accepted: boolean;
}

/** Reads the `business_profile_registration_requests` row for a mobile number, most-recently-modified first (see header comment on why not `created_at`). */
export async function getBusinessRegistrationRequestByMobileFromSql(mobileNumber: string): Promise<BusinessProfileRegistrationRequestRow | null> {
    const pool = await getSqlPool();
    const result = await pool.request()
        .input('mobile', mobileNumber)
        .query(`
            USE [emi_profile];
            SELECT TOP 1 id, created_at, last_modified_at, mobile_number, email, crn, profile_code,
                   is_completed_form, is_mobile_owner_ship_verified, is_wathiq_info_completed,
                   is_get_nafath_status_completed, is_product_assigned, is_contract_accepted
            FROM business_profile_registration_requests
            WHERE mobile_number = @mobile
            ORDER BY last_modified_at DESC;
        `);
    return (result.recordset[0] as BusinessProfileRegistrationRequestRow) ?? null;
}

export interface RegistrationFullDetail {
    id: string;
    created_at: string;
    email: string;
    mobile_number: string;
    tenant_number: string;
    profile_code: string;
    is_active: boolean;
    is_approved: boolean;
    identity_number: string;
    crn: string | null;
    is_contract_accepted: boolean | null;
    is_product_assigned: boolean | null;
    iban: string | null;
    vat_number: string | null;
    unified_number: string | null;
    company_title: string | null;
    city: string | null;
}

/**
 * One-shot cross-table read of everything a completed registration produces:
 * the provisioned `profiles` row joined to its originating
 * `business_profile_registration_requests` (by mobile), then that request's
 * own `business_profiles` (by CRN) and `company_address` (by
 * company_address_id). Confirmed live 2026-09-27 against a real
 * goToContractStep + Contract-submission run's own account. Returns null if
 * no `profiles` row exists yet for this mobile (registration never reached
 * the point of provisioning an actual account) — the joined columns are
 * individually nullable beyond that, since a profile can exist before its
 * business-side rows are fully populated.
 */
export async function getFullRegistrationDetailByMobileFromSql(mobileNumber: string): Promise<RegistrationFullDetail | null> {
    const pool = await getSqlPool();
    const result = await pool.request()
        .input('mobile', mobileNumber)
        .query(`
            USE [emi_profile];
            SELECT TOP 1 p.id, p.created_at, p.email, p.mobile_number, p.tenant_number, p.profile_code,
                   p.is_active, p.is_approved, p.identity_number,
                   bprr.crn, bprr.is_contract_accepted, bprr.is_product_assigned,
                   bp.iban, bp.vat_number, bp.unified_number,
                   ca.title AS company_title, ca.city
            FROM profiles p
            LEFT JOIN business_profile_registration_requests bprr ON bprr.mobile_number = p.mobile_number
            LEFT JOIN business_profiles bp ON bp.crn = bprr.crn
            LEFT JOIN company_address ca ON ca.id = bp.company_address_id
            WHERE p.mobile_number = @mobile
            ORDER BY p.created_at DESC;
        `);
    return (result.recordset[0] as RegistrationFullDetail) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mongo (notifications-log.notifications) — the actual dispatch record for the
// "User Activation" email a completed registration sends, independent of
// what the app's own confirmation screen claims. Schema and collection name
// confirmed live 2026-09-27 against the notification a real completed
// registration produced.
//
// Confirmed live the same day: `isSuccessfullySent` was `false` with
// `errorMessage` "Mail server connection failed... Couldn't connect to host,
// port: smtp.gmail.com, 587" — this dev environment's outbound SMTP is not
// reachable, so the UI's own "حسابك جاهز... راجع بريدك الإلكتروني" ("Your
// account is ready... check your email") confirmation is not actually backed
// by a delivered email here. That's an environment/infra fact, not something
// a registration-flow bug fix could address, so callers should assert the
// notification record EXISTS (proves the app attempted the handoff) without
// hard-asserting `isSuccessfullySent` — do that comparison explicitly at the
// call site instead, with its own environment-aware message, if a given test
// wants to track whether it's since started working.

export interface RegistrationActivationNotification {
    _id: string;
    userId: string;
    subject: string;
    recipient: string;
    message: string;
    notificationType: string;
    isSuccessfullySent: boolean;
    errorMessage?: string;
    createdAt: string;
}

/** Reads the most recent "User Activation" notification for a profile code straight from notifications-log.notifications. */
export async function getActivationNotificationFromMongo(profileCode: string): Promise<RegistrationActivationNotification | null> {
    const db = await getMongoDb('notifications-log');
    const doc = await db.collection('notifications')
        .find({ userId: profileCode, subject: 'User Activation' })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    return doc as RegistrationActivationNotification | null;
}
