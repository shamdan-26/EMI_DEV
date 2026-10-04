import { test, type Browser, type Page } from '@playwright/test';
import { COMMISSION_CATEGORY, ACCOUNT_TYPE, apiEntryToFormValues, type CommissionFormValues, type AdminCommissionManagementPage } from '../pageElements/CommissionManagement/AdminCommissionManagementPage';
import { loginToCommissionManagement, randomCommissionValues } from '../CommissionManagement/CommissionManagementHelper';
import { LoginPage } from '../pageElements/Shared/LoginPage';
import { OtpPage } from '../pageElements/Shared/OtpPage';
import { HomepageQuickActionsPage } from '../pageElements/Shared/HomepageQuickActionsPage';
import { AppShellPage } from '../pageElements/Shared/AppShellPage';
import { TopupPage } from '../pageElements/Topup/TopupPage';
import { getOtpFromDb } from '../Login/LoginHelper';
import { getMongoDb } from '../../support/mongoClient';
import { getSqlPool } from '../../support/sqlServerClient';
import topupData from '../../data/topupData.json';
import testAccounts from '../../data/testAccounts.json';

export const BASE_URL  = process.env['BASE_URL'] ?? 'https://uat.majdpay.com';
export const LOGIN_URL = `${BASE_URL}/business/auth/login`;
export const HOME_URL  = `${BASE_URL}/business/main/home`;

// ─────────────────────────────────────────────────────────────────────────────
// Shared setup for the "Core Scenarios" suites (Happy Path, UI, Negative,
// Security, API — one file per testing type, see BusinessTestCases/Topup/functional/).
// All of them log in as the same Biller account and share the same card-data
// lookup and popup-reaching helper, so it lives here once rather than being
// copy-pasted into every file.
//
// Account: the Biller account (data/testAccounts.json: company Q9557 /
// mobile 597389429), NOT topupData.json's own Merchant account (A3713).
// Confirmed live 2026-09-20: A3713's wallet returns
// COLLECTION_DESTINATION_WALLET_LIMITATION_EXCEEDED on POST /api/v1/payments
// for every amount and every payment method tried — a wallet-limitation-engine
// block (EMI-87) on that specific account, not a test or amount issue. Q9557
// has headroom and gets past initiation and OTP verification cleanly. Card
// number/expiry/holder/cvv still come from topupData.json per payment
// method — that data is gateway sandbox data, not account-specific.
//
// Step order follows the CONFIRMED live dev walkthrough in
// docs/manual-test-cases/Topup.md ("OTP is requested before card entry, not
// after"): Amount -> Proceed -> Summary -> Next (sends the OTP) -> OTP verify
// -> THEN the app redirects and opens the card-entry popup -> card details ->
// Pay Now -> gateway submit -> result. This is the opposite order the retired
// archive/TopupFlow.spec.ts assumed.
export const LOGIN_COMPANY = 'Q9557';
export const LOGIN_MOBILE = '597389429';
export const LOGIN_PASSWORD = process.env['LOGIN_PASSWORD'] ?? '';

export interface TopupAccount { company: string; mobile: string; password?: string }

/**
 * Account for the UI specs under Topup/ui/: company J7264 / mobile 500021788. The Biller
 * wallet accumulates every successful top-up and eventually hits
 * COLLECTION_DESTINATION_WALLET_LIMITATION_EXCEEDED, so UI testing runs on this account
 * instead. Functional specs keep the Biller account (they assert BILLER wallet type and
 * Biller-scoped commission). Password is the shared test default (data/testAccounts.json).
 * The wallet-code prefix depends on the account type — assert on the generic pattern.
 */
export const TOPUP_UI_ACCOUNT: TopupAccount = {
    company:  'J7264',
    mobile:   '500021788',
    password: testAccounts.defaultPassword,
};


export interface TopupCase {
    testName: string;
    companyNumber: string;
    mobileNumber: string;
    password: string;
    amount: string;
    paymentMethod: string;
    cardNumber: string;
    expiry: string;
    holder: string;
    cvv: string;
}

/** Looks up a payment method's sandbox card data from data/topupData.json. */
export function findTopupCase(method: 'MADA' | 'VISA' | 'MASTER'): TopupCase {
    const found = (topupData as TopupCase[]).find(d => d.testName === `Topup_with_Enter_Amount_${method}`);
    if (!found) {
        throw new Error(`findTopupCase: data/topupData.json no longer has a "Topup_with_Enter_Amount_${method}" entry.`);
    }
    return found;
}

export interface TopupSession {
    page: Page;
    loginPage: LoginPage;
    otp: OtpPage;
    quickActions: HomepageQuickActionsPage;
    topup: TopupPage;
    shell: AppShellPage;
    /** Mobile of the logged-in account — OTPs are fetched for this number. */
    mobile: string;
}

/** Logs into the Biller account and returns ready-to-use page objects — the standard beforeAll for every Core Scenarios file. */
export async function loginToTopup(browser: Browser, account: TopupAccount = { company: LOGIN_COMPANY, mobile: LOGIN_MOBILE }): Promise<TopupSession> {
    const page = await browser.newPage();
    const loginPage = new LoginPage(page);
    const otp = new OtpPage(page);
    const quickActions = new HomepageQuickActionsPage(page);
    const topup = new TopupPage(page);
    const shell = new AppShellPage(page);

    // Up to two attempts: dev's /auth/signin intermittently returns 404, and the
    // OTP screen can appear a moment AFTER submit — so wait for either the OTP
    // screen or the post-login page rather than checking for the OTP once.
    for (let attempt = 1; attempt <= 2; attempt++) {
        await loginPage.goto(LOGIN_URL);
        await loginPage.fillAndSubmit(account.company, account.mobile, account.password ?? LOGIN_PASSWORD);
        const next = await Promise.race([
            otp.inputs.first().waitFor({ state: 'visible', timeout: 20000 }).then(() => 'otp' as const),
            page.waitForURL(url => !url.pathname.includes('/auth/'), { timeout: 20000 }).then(() => 'home' as const),
        ]).catch(() => 'none' as const);
        if (next === 'otp') {
            await otp.fillAndVerify(await getOtpFromDb(account.mobile));
        }
        if (next !== 'none' || attempt === 2) break;
    }
    await page.waitForURL(url => !url.pathname.includes('/auth/'), { timeout: 30000 });

    return { page, loginPage, otp, quickActions, topup, shell, mobile: account.mobile };
}

/** Navigates fresh to the Topup amount-entry screen — the standard beforeEach for every Core Scenarios file. */
export async function gotoTopupScreen(session: TopupSession): Promise<void> {
    // A previous test that failed/skipped before its own `popup.close()` leaves
    // the gateway window open in this shared context — close any extra window
    // and point the page object back at the main page before starting fresh.
    for (const stray of session.page.context().pages()) {
        if (stray !== session.page) await stray.close().catch(() => { /* already closed */ });
    }
    session.topup.resetActivePage();

    await session.page.goto(HOME_URL);
    await session.page.waitForLoadState('domcontentloaded');
    await session.quickActions.quickActionTopupCard.click();
    await session.topup.inputAmount.waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Clicks Summary Next and reports whether the top-up OTP screen appeared. The
 * OTP is an admin-configurable operation (operationCode 102), so it may be
 * switched off — in that case the gateway popup opens straight after Next.
 */
export async function clickSummaryNextAndDetectOtp(topup: TopupPage, otp: OtpPage): Promise<boolean> {
    await topup.clickSummaryNextButton();
    return otp.inputs.first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true)
        .catch(() => false);
}

/**
 * Amount -> Proceed -> Summary -> Next (sends OTP) -> OTP screen visible,
 * left unfilled. Shared setup for tests that interact with the OTP screen
 * itself (input/button state, resend/cancel behavior, countdown) rather than
 * completing the flow past it — see `reachCardEntryPopup` for the
 * full-completion equivalent. Skips the calling test when the top-up OTP is
 * disabled, since there is no OTP screen to test.
 */
export async function reachOtpScreen(session: TopupSession, method: 'mada' | 'visa' | 'master', data: TopupCase): Promise<void> {
    const { topup, otp } = session;
    await topup.selectPaymentMethod(method);
    await topup.enterAmount(data.amount);
    await topup.clickProceedButton();
    await topup.waitForSummaryToSettle();
    const otpShown = await clickSummaryNextAndDetectOtp(topup, otp);
    test.skip(!otpShown, 'Top-up OTP is disabled (operationCode 102) — no OTP screen to test.');
}

/**
 * Amount -> Proceed -> Summary -> Next -> (OTP verify, if the top-up OTP is
 * enabled) -> gateway popup opens. Shared by every file whose scenario needs
 * to reach the card-entry popup.
 */
export async function reachCardEntryPopup(session: TopupSession, method: 'mada' | 'visa' | 'master', data: TopupCase): Promise<Page> {
    const { page, topup, otp } = session;
    await topup.selectPaymentMethod(method);
    await topup.enterAmount(data.amount);
    await topup.clickProceedButton();
    await topup.waitForSummaryToSettle();

    // Start listening for the gateway popup BEFORE triggering Next — it opens
    // right after Next when OTP is off, or after OTP verification when on.
    const popupPromise = page.context().waitForEvent('page', { timeout: 20000 });
    popupPromise.catch(() => { /* handled below — avoid an unhandled rejection if OTP verification takes long */ });

    // Capture a rejected payment-initiation call so a backend refusal (e.g. the
    // wallet's COLLECTION_DESTINATION_WALLET_LIMITATION_EXCEEDED once enough
    // top-ups have accumulated) is reported as such, not as a "gateway outage".
    let initiationFailure = '';
    const onResponse = async (res: import('@playwright/test').Response) => {
        if (res.request().method() === 'POST' && res.url().endsWith('/api/v1/payments') && res.status() >= 400) {
            const body = await res.text().catch(() => '');
            const code = /"messageCode":"([^"]+)"/.exec(body)?.[1] ?? '';
            initiationFailure = `HTTP ${res.status()}${code ? ` ${code}` : ''}`;
        }
    };
    page.on('response', onResponse);

    if (await clickSummaryNextAndDetectOtp(topup, otp)) {
        await otp.fillAndVerify(await getOtpFromDb(session.mobile));
    }

    let popup: Page;
    try {
        popup = await popupPromise;
    } catch {
        page.off('response', onResponse);
        if (initiationFailure) {
            throw new Error(`Payment initiation was rejected (${initiationFailure}) — the backend refused the top-up, so no gateway popup could open. For COLLECTION_DESTINATION_WALLET_LIMITATION_EXCEEDED the test wallet has reached its limit (see this file's header); it needs resetting, not a test fix.`);
        }
        throw new Error('Payment gateway popup did not open within 20s after Next / OTP verification — likely a backend/gateway outage, not a test issue.');
    }
    page.off('response', onResponse);
    topup.setActivePage(popup);
    await popup.waitForLoadState('load');
    return popup;
}

/**
 * Full card payment from the amount form through to the Payment Success
 * screen: popup -> card details -> Pay Now -> (3DS / HyperPay submit) ->
 * popup closes. Leaves the main page on the result screen with OK un-clicked.
 */
export async function completeCardPayment(session: TopupSession, method: 'mada' | 'visa' | 'master', data: TopupCase, gatewayReturnCode?: string): Promise<void> {
    const { topup } = session;
    const popup = await reachCardEntryPopup(session, method, data);
    await topup.fillCardDetails(data.cardNumber, data.expiry, data.holder, data.cvv);
    await topup.clickPayNowButton();
    // Optional simulator result. VISA (HyperPay): 1=Success, 2=User canceled,
    // 3=Pending, 4=limit exceeded, 5=too many tries — TopupPage.selectGatewayReturnCode.
    // MADA/MASTER (3-D Secure): Y=Approve, N=Decline, D=Decoupled Fallback,
    // U=Technical error, X=Cancel — TopupPage.select3dsOutcome.
    if (gatewayReturnCode) {
        if (method === 'mada' || method === 'master') {
            await topup.select3dsOutcome(gatewayReturnCode as 'Y' | 'N' | 'D' | 'U' | 'X');
        } else {
            await topup.selectGatewayReturnCode(gatewayReturnCode);
        }
    }
    if (method === 'mada' || method === 'master') {
        await topup.clickCardSchemeSubmitButton();
    } else if (await topup.isHyperpayScreenDisplayed()) {
        await topup.clickHyperpaySubmitButton();
    }
    await popup.waitForEvent('close', { timeout: 30000 }).catch(() => null);
    topup.resetActivePage();
}

/**
 * Bilingual Summary-step row labels. The Topup flow renders in Arabic by
 * default on dev/UAT (same reason BankTransferHelper.ts's SUMMARY_LABEL is
 * bilingual), so specs must locate summary rows by a language-neutral
 * pattern — a hardcoded English label never matches. Pass these to
 * `TopupPage.getSummaryText()` / `getSummaryMoney()`. Arabic copy confirmed
 * against a live dev run (account "ش ا" / MER-Q9EK4TTPGE-30, 2026-09-14).
 */
export const SUMMARY_LABEL = {
    txnType:    /^\s*(Transaction Type|نوع العملية)\s*$/i,
    method:     /^\s*(Payment Method|طريقة الدفع)\s*$/i,
    original:   /^\s*(Original Amount|المبلغ الأصلي)\s*$/i,
    commission: /^\s*(commission|العمولة)\s*$/i,
    vat:        /^\s*(VAT|ضريبة القيمة المضافة)\s*$/i,
    total:      /^\s*(Total amount to be sent|إجمالي المبلغ المراد استلامه)\s*$/i,
} as const;

/**
 * Top Up reads its commission schema from the admin-portal Default Commission
 * entry for the merchant side of the Cash-In category — see
 * `pageElements/CommissionManagement/AdminCommissionManagementPage.ts`.
 */
export const TOPUP_COMMISSION_CATEGORY = COMMISSION_CATEGORY.CASH_IN;
export const TOPUP_COMMISSION_ACCOUNT_TYPE = ACCOUNT_TYPE.MERCHANT;
export const TOPUP_COMMISSION_TRANSACTION_TYPE = 'Merchant Cashin';

export interface TopupCommissionSnapshot {
    /** The chosen row's platform/percentage-or-amount values, as found before any test ran. */
    values: CommissionFormValues;
    /** Whether the row was already Active before `prepareTopupCommission` touched it. */
    wasActive: boolean;
}

/**
 * Seed values used only when no WEB-platform Merchant Cashin row exists yet
 * and `prepareTopupCommission` has to create one. Only `platform` is fixed
 * (this seed must create a WEB row specifically) — the rest come fresh from
 * `randomCommissionValues()` each call so the boundaries/value/type-flag this
 * suite exercises aren't pinned to one hardcoded case.
 */
function defaultTopupCommissionSeed(): CommissionFormValues {
    return { ...randomCommissionValues(), platform: 'WEB' };
}

/**
 * The ONE admin-portal touch at the start of a Topup-Commission suite:
 *   1. Go to Default Commission.
 *   2. Select the WEB Merchant Cashin row — this suite tops up through the
 *      Web client, so the commission it validates has to be the one that
 *      actually applies to a Web-initiated top-up. Creates one
 *      (`defaultTopupCommissionSeed()`) if none exists yet.
 *   3. Read whether it's percentage- or fixed-amount, and its value.
 *   4. Check Status — if not Active, activate it.
 * Returns a snapshot of the row's values and original Active state so the
 * caller can restore the latter via `restoreTopupCommission()` afterwards —
 * restoring re-locates that *same* row by its values.
 *
 * Takes an already-logged-in `commission` handle (see
 * `loginToCommissionManagement`) rather than logging in itself — the caller
 * keeps that same admin session open for the whole suite, including the
 * later `restoreTopupCommission` call, so the admin portal is opened exactly
 * once per file instead of once per touch. A session that idles out partway
 * through a long merchant-side run is handled by
 * `AdminCommissionManagementPage`'s own `recoverFromExpiredSession` guard
 * (already wired into every row-mutating call this makes), not by avoiding a
 * long-lived session.
 */
export async function prepareTopupCommission(commission: AdminCommissionManagementPage): Promise<TopupCommissionSnapshot> {
    // 1. Go to Default Commission.
    await commission.gotoDefaultCommission();

    // 2. Select the WEB Merchant Cashin row, creating one if none exists.
    let found = await commission.findRowByTransactionTypeAndPlatform(TOPUP_COMMISSION_TRANSACTION_TYPE, 'WEB');
    if (!found) {
        // The wizard's "Choose ... Transaction" step lists individual
        // transaction types, not broad account types — pass the exact
        // "Merchant Cashin" label to select, not "Merchant" (confirmed
        // live: "Merchant" alone never matched anything in the rendered
        // list, so nothing was ever selected).
        await commission.createCommission(
            TOPUP_COMMISSION_CATEGORY,
            TOPUP_COMMISSION_TRANSACTION_TYPE,
            defaultTopupCommissionSeed(),
        );
        found = await commission.findRowByTransactionTypeAndPlatform(TOPUP_COMMISSION_TRANSACTION_TYPE, 'WEB');
        if (!found) {
            // The list's own re-fetch right after the create-modal closes
            // can transiently race back empty ("No data found" for a grid
            // that demonstrably has rows) — a dev-environment backend blip
            // (see the identical retry in `prepareBillerTopupCommission`).
            // A full re-navigation clears whatever caused it; retry once.
            await commission.gotoDefaultCommission();
            found = await commission.findRowByTransactionTypeAndPlatform(TOPUP_COMMISSION_TRANSACTION_TYPE, 'WEB');
        }
        if (!found) {
            throw new Error(
                `Created a new WEB "${TOPUP_COMMISSION_TRANSACTION_TYPE}" commission but no matching row ` +
                `appeared in Default Commission afterwards (retried once).`,
            );
        }
    }
    const { row, values } = found; // 3. percentage-or-amount + value, already read.

    // 4. Status — activate if needed, remembering the original state.
    const wasActive = await commission.isRowActive(row);
    if (!wasActive) await commission.activateRow(row);

    return { values, wasActive };
}

/**
 * Restores the Merchant Cashin row `prepareTopupCommission` chose back to its
 * original Active state. Re-locates that exact row by its snapshotted values
 * (`findRowByTransactionTypeAndValues`) rather than picking a fresh random
 * row, so a suite with duplicate rows doesn't restore the wrong one. Call
 * this in the suite's `afterAll` as a safety net — a no-op write if nothing
 * in between changed it. Does not touch the value/percentage flag; nothing in
 * this suite edits those.
 *
 * Takes the SAME `commission` handle `prepareTopupCommission` used, rather
 * than logging in again — see that function's header comment for why the
 * admin session is kept open across the whole file instead of reopened here.
 */
export async function restoreTopupCommission(commission: AdminCommissionManagementPage, snapshot: TopupCommissionSnapshot): Promise<void> {
    if (snapshot.wasActive) return; // it was already Active — nothing to undo.

    await commission.gotoDefaultCommission();
    const row = await commission.findRowByTransactionTypeAndValues(
        TOPUP_COMMISSION_TRANSACTION_TYPE,
        snapshot.values,
    );
    if (row) await commission.disableRow(row);
}

/**
 * Seed values used only when no APP-platform Merchant Cashin row exists yet
 * and `ensureAppScopedTopupCommission` has to create one. Only `platform` is
 * fixed (this seed must create an APP row specifically) — the rest come
 * fresh from `randomCommissionValues()` each call, same as
 * `defaultTopupCommissionSeed()`.
 */
function appScopedCommissionSeed(): CommissionFormValues {
    return { ...randomCommissionValues(), platform: 'APP' };
}

/**
 * TU-CM32-only: finds the APP-platform Merchant Cashin tier (a *different*
 * row than the one `prepareTopupCommission` chose for every other TU-CM
 * test), creating one (`appScopedCommissionSeed()`) if none exists yet,
 * activates it if needed, and returns its values plus original Active state.
 *
 * This is a deliberate, narrow exception to "the admin portal is opened
 * exactly once for this file" (see TopupCommission.spec.ts's header
 * comment): TU-CM32 needs a row the shared beforeAll/afterAll never look at,
 * so it manages its own short-lived admin touch rather than overloading the
 * shared snapshot with a second, differently-filtered lookup.
 */
export async function ensureAppScopedTopupCommission(browser: Browser): Promise<TopupCommissionSnapshot> {
    const { context, commission } = await loginToCommissionManagement(browser);
    try {
        await commission.gotoDefaultCommission();
        let found = await commission.findRowByTransactionTypeAndPlatform(TOPUP_COMMISSION_TRANSACTION_TYPE, 'APP');

        if (!found) {
            // See the identical note in `prepareTopupCommission` — select the
            // exact transaction type, not the broader account type.
            await commission.createCommission(
                TOPUP_COMMISSION_CATEGORY,
                TOPUP_COMMISSION_TRANSACTION_TYPE,
                appScopedCommissionSeed(),
            );
            found = await commission.findRowByTransactionTypeAndPlatform(TOPUP_COMMISSION_TRANSACTION_TYPE, 'APP');
            if (!found) {
                // See the identical retry in `prepareTopupCommission` above.
                await commission.gotoDefaultCommission();
                found = await commission.findRowByTransactionTypeAndPlatform(TOPUP_COMMISSION_TRANSACTION_TYPE, 'APP');
            }
            if (!found) {
                throw new Error(
                    `Created a new APP "${TOPUP_COMMISSION_TRANSACTION_TYPE}" commission but no matching row ` +
                    `appeared in Default Commission afterwards (retried once).`,
                );
            }
        }

        const wasActive = await commission.isRowActive(found.row);
        if (!wasActive) await commission.activateRow(found.row);

        return { values: found.values, wasActive };
    } finally {
        await context.close();
    }
}

/**
 * Restores the APP-platform row `ensureAppScopedTopupCommission` touched back
 * to its original Active state. Mirrors `restoreTopupCommission` but re-locates
 * by the APP row's own snapshotted values, independent of the main tier.
 */
export async function restoreAppScopedTopupCommission(browser: Browser, snapshot: TopupCommissionSnapshot): Promise<void> {
    if (snapshot.wasActive) return;

    const { context, commission } = await loginToCommissionManagement(browser);
    try {
        await commission.gotoDefaultCommission();
        const row = await commission.findRowByTransactionTypeAndValues(
            TOPUP_COMMISSION_TRANSACTION_TYPE,
            snapshot.values,
        );
        if (row) await commission.disableRow(row);
    } finally {
        await context.close();
    }
}

/**
 * The ACTIVE Core Scenarios suite (Happy Path/Negative/UI/Security/API — see
 * this file's own header comment) logs in as the Biller account (Q9557), not
 * the Merchant account `TOPUP_COMMISSION_TRANSACTION_TYPE` above targets.
 * Confirmed live 2026-09-22 via the admin portal's "Choose ... Transaction"
 * dropdown (Cash-In category, Biller account type): this account's top-ups
 * are rated under the exact label "Biller Bank Cashin" — matching the SQL
 * `transaction_log.txn_type_name` this suite already asserts on in
 * TopupHappyPath.spec.ts. Everything below mirrors the Merchant-scoped
 * functions above 1:1, just against this row instead.
 */
export const TOPUP_BILLER_COMMISSION_ACCOUNT_TYPE = ACCOUNT_TYPE.BILLER;
export const TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE = 'Biller Bank Cashin';
/**
 * The backend's own numeric identifier for "Biller Bank Cashin". The list
 * API (`GET /api/v1/default-commissions`) never returns a friendly name at
 * all, only this code — confirmed live 2026-09-25 by cross-referencing an
 * API entry's min/max/value/platform (184-70550, 360%, WEB) against this
 * file's own beforeAll log line reporting those exact numbers for "Biller
 * Bank Cashin" on the same run.
 */
export const TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE = '102003';

/** Seed values for a fresh WEB-platform Biller Bank Cashin row — see `defaultTopupCommissionSeed`. */
function defaultBillerTopupCommissionSeed(): CommissionFormValues {
    return { ...randomCommissionValues(), platform: 'WEB' };
}

/**
 * Biller-account counterpart of `prepareTopupCommission` — see its header
 * comment for the full rationale.
 *
 * Looks the row up via `apiFindCommission` (a direct, authenticated call to
 * the same API the grid itself calls), not a grid-text scan or UI filter —
 * confirmed live 2026-09-24/25 that the "Biller Bank Cashin" WEB row's
 * transaction-type cell can render as a raw internal code instead of the
 * friendly name (which a text-scan can never match), and that even the
 * filter panel's own dropdown UI is flaky enough (silent no-op selections,
 * race conditions on "No Data Found") to wrongly report "not found" and
 * fall through to creating a duplicate the backend then rejects with 409
 * COMMISSION_ALREADY_EXISTS. The API has no such ambiguity: it deals only in
 * the numeric code and an explicit `platformType`/`isActive` field.
 */
export async function prepareBillerTopupCommission(commission: AdminCommissionManagementPage): Promise<TopupCommissionSnapshot> {
    await commission.gotoDefaultCommission();

    let entry = await commission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, 'WEB');
    if (!entry) {
        await commission.createCommission(
            TOPUP_COMMISSION_CATEGORY,
            TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE,
            defaultBillerTopupCommissionSeed(),
        );
        entry = await commission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, 'WEB');
        if (!entry) {
            throw new Error(
                `Created a new WEB "${TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE}" commission but the API still shows ` +
                `no entry for code ${TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE} (WEB) afterwards.`,
            );
        }
    }

    const values = apiEntryToFormValues(entry);
    const wasActive = entry.isActive;
    if (!wasActive) await commission.apiSetActive(entry.id, true);

    return { values, wasActive };
}

/**
 * Biller-account counterpart of `restoreTopupCommission` — see its header
 * comment for the full rationale. Looks the row up by code + the snapshotted
 * platform via the API (see `prepareBillerTopupCommission`'s header comment
 * for why) — there is only ever one commission row per (transaction type,
 * platform) pair (confirmed live 2026-09-24: the backend itself enforces
 * this, rejecting a second one with 409 COMMISSION_ALREADY_EXISTS), so the
 * platform alone already identifies the exact row to restore.
 */
export async function restoreBillerTopupCommission(commission: AdminCommissionManagementPage, snapshot: TopupCommissionSnapshot): Promise<void> {
    if (snapshot.wasActive) return;

    await commission.gotoDefaultCommission();
    const entry = await commission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, snapshot.values.platform);
    if (entry) await commission.apiSetActive(entry.id, false);
}

/** Seed values for a fresh APP-platform Biller Bank Cashin row — see `appScopedCommissionSeed`. */
function appScopedBillerCommissionSeed(): CommissionFormValues {
    return { ...randomCommissionValues(), platform: 'APP' };
}

/**
 * Biller-account counterpart of `ensureAppScopedTopupCommission` — see its
 * header comment for the full rationale. Uses `apiFindCommission` — see
 * `prepareBillerTopupCommission`'s header comment for why.
 *
 * Takes an existing `commission` session rather than opening its own — the
 * original rationale for a separate short-lived admin login here was to
 * avoid disturbing the shared session's UI-filtered state (a different grid
 * page/filter than what the WEB row lookup needed). That rationale no longer
 * applies now that lookups are stateless API calls, and a second concurrent
 * login as the same admin user has been confirmed live (2026-09-25/27) to
 * invalidate the first session's token outright (a single-session-per-user
 * policy, evidenced by 401 SESSION_INVALID on the shared session immediately
 * after this second login, even on a token barely a minute old) — reusing
 * one session avoids that entirely.
 */
export async function ensureAppScopedBillerTopupCommission(commission: AdminCommissionManagementPage): Promise<TopupCommissionSnapshot> {
    await commission.gotoDefaultCommission();
    let entry = await commission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, 'APP');

    if (!entry) {
        await commission.createCommission(
            TOPUP_COMMISSION_CATEGORY,
            TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE,
            appScopedBillerCommissionSeed(),
        );
        entry = await commission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, 'APP');
        if (!entry) {
            throw new Error(
                `Created a new APP "${TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE}" commission but the API still shows ` +
                `no entry for code ${TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE} (APP) afterwards.`,
            );
        }
    }

    const values = apiEntryToFormValues(entry);
    const wasActive = entry.isActive;
    if (!wasActive) await commission.apiSetActive(entry.id, true);

    return { values, wasActive };
}

/**
 * Biller-account counterpart of `restoreAppScopedTopupCommission` — see its
 * header comment for the full rationale. Looks the row up by code +
 * platform via the API — see `restoreBillerTopupCommission`'s header
 * comment for why that alone reliably identifies the exact row. Takes an
 * existing `commission` session — see `ensureAppScopedBillerTopupCommission`'s
 * header comment for why a second concurrent login is avoided.
 */
export async function restoreAppScopedBillerTopupCommission(commission: AdminCommissionManagementPage, snapshot: TopupCommissionSnapshot): Promise<void> {
    if (snapshot.wasActive) return;

    await commission.gotoDefaultCommission();
    const entry = await commission.apiFindCommission(TOPUP_BILLER_COMMISSION_TRANSACTION_TYPE_CODE, snapshot.values.platform);
    if (entry) await commission.apiSetActive(entry.id, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct DB assertions (transaction_query_log.transactionLog) — schema and
// field names confirmed live 2026-09-22 against real Biller Cashin documents
// this account's own top-ups produced, not guessed. See support/mongoClient.ts
// for the connection itself and why direct DB access exists again after
// being dropped in 7e7b5583.

export interface TopupTransactionLogEntry {
    _id: string;
    status: string;
    destinationAmount: string;
    destinationCurrency: string;
    destinationWalletCode: string;
    initiator: string;
    txnTypeName: string;
    createdAt: string;
    batchTransactionReference: string;
}

/**
 * Decodes the JWT's `profileCode` claim (no signature check — this is a
 * read-only test helper, not an auth boundary) from a captured
 * `Authorization: Bearer <token>` header. `transactionLog.initiator` is this
 * same value — confirmed live 2026-09-22 by cross-referencing a live token's
 * profileCode against the `initiator` field on the transaction it produced.
 */
export function decodeJwtProfileCode(bearerToken: string): string {
    const token = bearerToken.replace(/^Bearer\s+/i, '');
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) throw new Error(`decodeJwtProfileCode: not a JWT — "${bearerToken.slice(0, 20)}..."`);
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64').toString('utf-8')) as { profileCode?: string };
    if (!payload.profileCode) throw new Error('decodeJwtProfileCode: token payload has no profileCode claim');
    return payload.profileCode;
}

/**
 * Reads the most recent "Biller Bank Cashin" transactionLog entry for the
 * given initiator (the account's JWT profileCode) directly from
 * transaction_query_log — the same record the app itself posts the wallet
 * credit from, independent of what the UI's Home page/Transactions list
 * renders.
 */
export async function getLatestTopupTransactionFromDb(initiatorProfileCode: string): Promise<TopupTransactionLogEntry | null> {
    const db = await getMongoDb('transaction_query_log');
    const doc = await db.collection('transactionLog')
        .find({ initiator: initiatorProfileCode, txnTypeName: 'Biller Bank Cashin' })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    return doc as TopupTransactionLogEntry | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL Server (emi_transaction.base_transaction) — the relational, likely
// authoritative ledger row behind the same top-up, separate from the Mongo
// read-model above. Schema confirmed live 2026-09-22 against this account's
// own real top-up rows, not guessed. `status` here is "POSTED" (ledger
// posting state), not Mongo's "SUCCESS"/"PENDING" outcome vocabulary — the
// two DBs use different terms for related but distinct concepts.

export interface TopupBaseTransactionRow {
    id: string;
    created_at: string;
    type: string;
    status: string;
    amount: number;
    destination_wallet_code: string;
    destination_wallet_type: string;
    destination_profile_code: string;
    destination_commission_amount: number | null;
    destination_vat_amount: number | null;
    initiator: string;
    idempotency_key: string;
    batch_transaction_reference: string;
}

/**
 * Reads the most recent PAYMENT_TRANSACTION row for the given initiator
 * (the account's JWT profileCode) directly from
 * emi_transaction.base_transaction. Column list confirmed live 2026-09-22
 * against real rows this account's own top-ups produced.
 */
export async function getLatestTopupTransactionFromSql(initiatorProfileCode: string): Promise<TopupBaseTransactionRow | null> {
    const pool = await getSqlPool();
    const result = await pool.request()
        .input('initiator', initiatorProfileCode)
        .query(`
            USE [emi_transaction];
            SELECT TOP 1 id, created_at, type, status, amount,
                   destination_wallet_code, destination_wallet_type, destination_profile_code,
                   destination_commission_amount, destination_vat_amount,
                   initiator, idempotency_key, batch_transaction_reference
            FROM base_transaction
            WHERE initiator = @initiator AND type = 'PAYMENT_TRANSACTION'
            ORDER BY created_at DESC;
        `);
    return (result.recordset[0] as TopupBaseTransactionRow) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL Server (emi_transaction.transaction_log) — a near-identical schema
// twin of Mongo's transaction_query_log.transactionLog (same field names,
// snake_case here vs camelCase there — this SQL table is likely the source
// the Mongo read-model is itself projected from), but distinct from
// base_transaction: its `status` uses the SAME vocabulary as Mongo
// ("SUCCESS"/"PENDING"/"FAILED"), not base_transaction's "POSTED", and it
// carries a `reasons` field (e.g. "HYPER-PAY-FAILURE",
// "PENDING-CLIENT-PAYMENT") naming WHY a non-success status happened.
// Schema confirmed live 2026-09-22 against real rows.

export interface TopupTransactionLogSqlRow {
    id: string;
    created_at: string;
    status: string;
    reasons: string;
    destination_amount: number;
    destination_currency: string;
    destination_reference: string;
    destination_wallet_code: string;
    initiator: string;
    txn_type_name: string;
    idempotency_key: string;
    batch_transaction_reference: string;
}

/**
 * Reads the most recent "Biller Bank Cashin" row for the given initiator
 * (the account's JWT profileCode) directly from emi_transaction.transaction_log.
 */
export async function getLatestTopupTransactionLogFromSql(initiatorProfileCode: string): Promise<TopupTransactionLogSqlRow | null> {
    const pool = await getSqlPool();
    const result = await pool.request()
        .input('initiator', initiatorProfileCode)
        .query(`
            USE [emi_transaction];
            SELECT TOP 1 id, created_at, status, reasons, destination_amount, destination_currency,
                   destination_reference, destination_wallet_code, initiator, txn_type_name,
                   idempotency_key, batch_transaction_reference
            FROM transaction_log
            WHERE initiator = @initiator AND txn_type_name = 'Biller Bank Cashin'
            ORDER BY created_at DESC;
        `);
    return (result.recordset[0] as TopupTransactionLogSqlRow) ?? null;
}

/**
 * Reads EVERY transaction_log row sharing the same idempotency_key, oldest
 * first — the full status lifecycle for one logical top-up, not just its
 * latest/terminal row. Confirmed live 2026-09-22: a single top-up produces
 * (at least) two rows sharing one idempotency_key — a PENDING one written
 * when the gateway call is initiated, then a terminal one (SUCCESS/FAILED)
 * once the gateway responds — rather than one row mutated in place.
 */
export async function getTopupTransactionLogHistoryFromSql(idempotencyKey: string): Promise<TopupTransactionLogSqlRow[]> {
    const pool = await getSqlPool();
    const result = await pool.request()
        .input('idempotencyKey', idempotencyKey)
        .query(`
            USE [emi_transaction];
            SELECT id, created_at, status, reasons, destination_amount, destination_currency,
                   destination_reference, destination_wallet_code, initiator, txn_type_name,
                   idempotency_key, batch_transaction_reference
            FROM transaction_log
            WHERE idempotency_key = @idempotencyKey
            ORDER BY created_at ASC;
        `);
    return result.recordset as TopupTransactionLogSqlRow[];
}
