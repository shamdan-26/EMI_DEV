import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { getOtpFromDb, fillOTP } from '../BusinessTestCases/Registration/RegistrationHelper';
import {
    loginAsMerchant,
    homepageAccountPool,
    LOGIN_URL,
    watchAuthGatewayFailure,
    formatGatewayNote,
} from '../BusinessTestCases/Homepage/HomePageHelper';

const env            = process.env['ENV'] ?? 'dev';
const VALID_COMPANY  = process.env['DEV_SETUP_COMPANY'];
const VALID_MOBILE   = process.env['DEV_SETUP_MOBILE'];
const VALID_PASSWORD = process.env['DEV_SETUP_PASSWORD'];

async function globalSetup() {
    const browser = await chromium.launch();

    if (!VALID_COMPANY || !VALID_MOBILE || !VALID_PASSWORD) {
        console.warn('[global-setup] DEV_SETUP_COMPANY / DEV_SETUP_MOBILE / DEV_SETUP_PASSWORD not set — skipping session.json creation. Tests using storageState: \'session.json\' will be skipped or fail.');
    } else {
        const context = await browser.newContext();
        const page    = await context.newPage();

        const attemptSessionLogin = async (): Promise<void> => {
            // A cold/stale auth gateway can 404 the first hit after a deploy
            // — a genuine hard refresh (CDP cache-disable) reliably avoids
            // it. Confirmed live 2026-09-23: the previous page.goto() +
            // page.reload() pairing still hit "Auth gateway returned 404 for
            // /auth/signin" despite the reload — page.reload() is still
            // allowed to serve a conditionally-cached/stale bundle, it
            // doesn't actually bypass the HTTP cache the way the old comment
            // here assumed (same root cause already fixed for the admin
            // portal's login — see AdminOtpConfigPage.ts's hardRefresh()).
            const client = await context.newCDPSession(page);
            await client.send('Network.setCacheDisabled', { cacheDisabled: true });
            await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.getByRole('textbox', { name: /Company number|رقم الشركة/ }).fill(VALID_COMPANY);
            await page.getByRole('textbox', { name: /Mobile number|رقم الجوال/ }).fill(VALID_MOBILE);
            await page.locator('input[aria-label="Password"], input[aria-label="كلمة المرور"]').fill(VALID_PASSWORD);
            const stopWatchingGateway = watchAuthGatewayFailure(page);
            try {
                // QA-DATA-TESTID-HANDOFF.md §4.1: `login-submit`, with the same
                // env fallback used by HomePageHelper.ts's loginButton().
                const loginBtn = page.getByTestId('login-submit')
                    .or(env === 'dev' ? page.locator('#btn_login') : page.getByRole('button', { name: 'Log In' }));
                await loginBtn.click();

                // Handle OTP if the environment has it enabled
                const otpVisible = await page.getByRole('heading', { name: 'Enter OTP' })
                    .waitFor({ state: 'visible', timeout: 15000 })
                    .then(() => true)
                    .catch(() => false);

                if (!otpVisible) {
                    const gatewayStatus = stopWatchingGateway();
                    // No OTP screen and still on the login page means the login never
                    // actually succeeded — surface why instead of silently saving an
                    // unauthenticated session.json.
                    if (page.url() === LOGIN_URL) {
                        throw new Error(`Login did not reach OTP or home screen. Current URL: ${page.url()}.${formatGatewayNote(gatewayStatus)}`);
                    }
                    return;
                }

                stopWatchingGateway();
                await page.getByRole('textbox', { name: 'One time password input' }).first()
                    .waitFor({ state: 'visible', timeout: 10000 });
                const otp = await getOtpFromDb(VALID_MOBILE);
                await fillOTP(page, otp);
                const verifyBtn = page.getByRole('button', { name: 'Verify' });
                if (await verifyBtn.isVisible().catch(() => false)) {
                    await verifyBtn.click();
                }
                await page.waitForURL(url => !url.pathname.includes('/auth/'), { timeout: 30000 });
            } finally {
                // Idempotent (page.off()); guarantees the 'response' listener is
                // detached even when OTP fetch / fillOTP / waitForURL throws, so the
                // retry below doesn't stack a second listener on the reused page.
                stopWatchingGateway();
            }
        };

        try {
            try {
                await attemptSessionLogin();
            } catch (err) {
                console.warn(`[global-setup] session.json login attempt failed, retrying once. Cause: ${err}`);
                await new Promise(r => setTimeout(r, 3000));
                await attemptSessionLogin();
            }

            // Save cookies + localStorage so tests can restore the authenticated state
            await context.storageState({ path: 'session.json' });
            await context.close();
        } catch (err) {
            console.warn(`[global-setup] session.json creation failed, continuing without it. Tests using storageState: 'session.json' will be skipped or fail. Cause: ${err}`);
        }
    }

    // Homepage suite: pre-authenticate every account in the pool once here, so
    // individual homepage spec files restore via storageState instead of each
    // logging in live (faster, and — since createHomepageSession() picks an
    // account by worker index — avoids concurrent same-account login
    // collisions between parallel workers). The pool has 2 accounts today;
    // add more via DEV_COMPANY_3/DEV_MOBILE_3/DEV_PASSWORD_3 (etc.) and they're
    // authenticated here automatically, no changes needed in this file.
    //
    // Non-fatal: these accounts are only consumed by the homepage suite, but
    // globalSetup runs before every test file. If browser automation here
    // crashes or times out (e.g. a flaky Chromium launch), swallow it instead
    // of failing every other suite's ability to run at all.
    mkdirSync('playwright/.auth', { recursive: true });
    for (const account of homepageAccountPool) {
        await saveAuthenticatedStorageState(account.storageState, account.creds);
    }

    async function saveAuthenticatedStorageState(storagePath: string, creds: { company: string; mobile: string; password: string }) {
        try {
            const context = await browser.newContext();
            const page    = await context.newPage();
            await loginAsMerchant(page, creds);
            await context.storageState({ path: storagePath });
            await context.close();
        } catch (err) {
            console.warn(`[global-setup] Failed to create homepage storage state at ${storagePath}, continuing without it. Homepage tests relying on it will fail. Cause: ${err}`);
        }
    }

    await browser.close();
}

export default globalSetup;
