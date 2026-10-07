import type { Page } from '@playwright/test';
import { fetchOtpFromEmail } from '../../support/emailOtp';
import { waitForToastClear } from '../toastMessages';
import { LoginPage } from '../pageElements/Shared/LoginPage';
import testAccounts from '../../data/testAccounts.json';

export const LOGIN_URL    = `${process.env['BASE_URL'] ?? 'https://uat.majdpay.com'}/business/auth/login`;
export const SESSION_PATH = 'session.json';

// Account used for wrong-password / invalid-credential tests.
export const VALID_COMPANY  = process.env['DEV_COMPANY'] ?? testAccounts.merchant.company;
export const VALID_MOBILE   = process.env['DEV_MOBILE']  ?? testAccounts.merchant.mobile;

// Account used for successful-login tests (happy path, OTP flow, validation card).
// Same shared merchant account as above — its password is testAccounts.defaultPassword.
export const LOGIN_COMPANY  = process.env['DEV_LOGIN_COMPANY'] ?? testAccounts.merchant.company;
export const LOGIN_MOBILE   = process.env['DEV_LOGIN_MOBILE']  ?? testAccounts.merchant.mobile;

export const VALID_PASSWORD = testAccounts.defaultPassword;
export const WRONG_PASSWORD = testAccounts.wrongPassword;

// DEV-only OTP bypass — in UAT use getOtpFromDb() instead.
export const VALID_OTP   = testAccounts.validOtp;
export const INVALID_OTP = testAccounts.invalidOtp;

// Dedicated accounts for account-status and lockout tests (set via env vars).
export const LOCKED_COMPANY      = process.env['LOCKED_COMPANY']      ?? '';
export const LOCKED_MOBILE       = process.env['LOCKED_MOBILE']        ?? '';
export const DEACTIVATED_COMPANY = process.env['DEACTIVATED_COMPANY']  ?? '';
export const DEACTIVATED_MOBILE  = process.env['DEACTIVATED_MOBILE']   ?? '';
export const AML_COMPANY         = process.env['AML_COMPANY']          ?? '';
export const AML_MOBILE          = process.env['AML_MOBILE']           ?? '';
export const LOCKOUT_COMPANY     = process.env['LOCKOUT_COMPANY']      ?? '';
export const LOCKOUT_MOBILE      = process.env['LOCKOUT_MOBILE']       ?? '';
export const LOCKOUT_PASSWORD    = process.env['LOCKOUT_PASSWORD']     ?? VALID_PASSWORD;

// EMI-5836 — dedicated accounts whose NAFATH/WATHIQ *document* has expired
// (is_nafath_data_expired / is_wathiq_data_expired = true via the government
// document-expiration validation job). Set via env vars once QA has these
// provisioned in UAT; every test consuming these is skipped, not failed,
// when unset. There is deliberately no equivalent pair for the Redis-*TTL*-only
// expiry variant — that state isn't reachable through any UI/API surface QA
// controls (it's set by the internal Redis TTL-monitoring job), so those
// scenarios are covered as skip(true)-pending in the spec instead of being
// wired to env vars that could never be satisfied.
export const NAFATH_EXPIRED_COMPANY  = process.env['NAFATH_EXPIRED_COMPANY']  ?? '';
export const NAFATH_EXPIRED_MOBILE   = process.env['NAFATH_EXPIRED_MOBILE']   ?? '';
export const NAFATH_EXPIRED_PASSWORD = process.env['NAFATH_EXPIRED_PASSWORD'] ?? VALID_PASSWORD;
export const WATHIQ_EXPIRED_COMPANY  = process.env['WATHIQ_EXPIRED_COMPANY']  ?? '';
export const WATHIQ_EXPIRED_MOBILE   = process.env['WATHIQ_EXPIRED_MOBILE']   ?? '';
export const WATHIQ_EXPIRED_PASSWORD = process.env['WATHIQ_EXPIRED_PASSWORD'] ?? VALID_PASSWORD;

/** Generates a random valid KSA-format mobile (9 digits, starts with 5) not present in UAT test data. */
export function generateUnregisteredMobile(): string {
    const random = Math.floor(Math.random() * 100_000_000).toString().padStart(8, '0');
    return `5${random}`;
}

export async function getOtpFromDb(
    mobile: string,
    maxAttempts = 10,
    delayMs = 2000,
    messageFilter: RegExp = /Use this OTP/i
): Promise<string> {
    if ((process.env['ENV'] ?? 'dev') === 'dev') return VALID_OTP;
    return fetchOtpFromEmail(mobile, maxAttempts, delayMs, messageFilter);
}

export async function fillOtpInputs(page: Page, otp: string): Promise<void> {
    const inputs = page.getByRole('textbox', { name: 'One time password input' });
    const count  = await inputs.count();
    for (let i = 0; i < count; i++) {
        await inputs.nth(i).pressSequentially(otp[i] ?? '0', { delay: 50 });
    }
}

export async function gotoLogin(page: Page): Promise<void> {
    const loginPage = new LoginPage(page);
    await loginPage.goto(LOGIN_URL);
}

export async function fillAndSubmitLogin(page: Page): Promise<void> {
    const loginPage = new LoginPage(page);
    await loginPage.fillAndSubmit(LOGIN_COMPANY, LOGIN_MOBILE, VALID_PASSWORD);
}
