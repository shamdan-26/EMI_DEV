import { type Page, type Locator, type Browser, type BrowserContext, expect } from '@playwright/test';
import { OtpPage } from './OtpPage';

/**
 * Admin Portal → System Configurations → OTP  ("OTP Configuration" screen).
 *
 * This is the *admin* SPA (`/admin/...`), a different app from the merchant
 * `/business/...` portal every other page object here targets, so it carries
 * its own login rather than reusing `session.json` / `LoginPage`. Credentials
 * default to the shared dev admin account and are overridable via env vars.
 *
 * Used by both Login/ and Registration/ to assert that the OTP *operation*
 * assignment for LOGIN / registration is locked on in the default OTP setting
 * (the checkbox is checked and disabled — the platform mandates OTP on those
 * flows and an admin cannot detach them from a setting). Hence Shared/.
 *
 * Locators are page-authored `id`s read off the live dev DOM (2026-09-09) —
 * the admin portal is not in QA-DATA-TESTID-HANDOFF.md. Key anchors:
 *   #otp-configurations-list-row-options-button   per-row ⋮ menu
 *   #otp-configurations-list-row-option-edit-operation   "Edit Operations" item
 *   #operations-modal-container                    the "All Operations" modal
 *   #input_type_text_name_standalone_<CODE>        per-operation name field
 *   #operations-modal-operation-checkbox-<n>       per-operation checkbox
 * A locked (assigned + non-detachable) checkbox also carries `.disabled-checkbox`.
 */

const BASE_URL = process.env['BASE_URL'] ?? 'https://dev.majdpay.com';

export const ADMIN_LOGIN_URL = `${BASE_URL}/admin/auth/login`;
export const ADMIN_OTP_CONFIG_URL = `${BASE_URL}/admin/main/configuration/otp`;

export const ADMIN_MOBILE   = process.env['ADMIN_MOBILE']   ?? '+966510202020';
export const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'Aa#1234567';
// Confirmed live 2026-09-22: this admin account now goes through a 6-box OTP
// step after Login is clicked (it previously didn't — see login()'s comment).
// Same dev-environment all-zeros bypass CLAUDE.md documents for the merchant
// login's 8-digit OTP, confirmed separately for Topup's 6-digit transaction
// OTP (TopupNegative.spec.ts) — this is the 6-digit form of the same bypass.
export const ADMIN_OTP_CODE = process.env['ADMIN_OTP_CODE'] ?? '000000';

/** OTP operation codes as they appear in the name field id suffix. */
export const OTP_OPERATION = {
    LOGIN: 'LOGIN',
    REGISTRATION: 'registration',
} as const;

// Riyadh — matches playwright.config.ts's geolocation. The admin SPA throws a
// blocking `app-permission-overlay` over the whole page (login form included)
// until location is granted, so a bare `browser.newPage()` — which does NOT
// inherit the config's `use` permissions — can never fill the form.
const ADMIN_GEOLOCATION = { latitude: 24.7136, longitude: 46.6753 };

/**
 * A context set up the way the admin SPA needs: geolocation granted for the
 * dev origin so its permission overlay never mounts. Use this in a spec's
 * `beforeAll` instead of `browser.newPage()`.
 */
export async function createAdminContext(browser: Browser): Promise<BrowserContext> {
    const context = await browser.newContext({
        viewport: null, // match playwright.config's project (real maximized window)
        permissions: ['geolocation'],
        geolocation: ADMIN_GEOLOCATION,
    });
    await context.grantPermissions(['geolocation'], { origin: BASE_URL });
    return context;
}

export class AdminOtpConfigPage {
    readonly page: Page;

    readonly usernameInput: Locator;
    readonly passwordInput: Locator;
    readonly loginButton: Locator;
    /** Shown on the login page after a failed sign-in when the account is locked. */
    readonly accountLockedNotice: Locator;
    readonly unlockAccountLink: Locator;

    readonly functionOtpTab: Locator;
    readonly firstRowOptionsButton: Locator;
    readonly editOperationsMenuItem: Locator;

    readonly operationsModal: Locator;
    readonly operationsModalHeader: Locator;
    readonly operationsModalCloseIcon: Locator;
    readonly permissionOverlay: Locator;

    constructor(page: Page) {
        this.page = page;

        this.usernameInput = page.locator('input:not([type="password"])').first();
        this.passwordInput = page.locator('input[type="password"]').first();
        this.loginButton   = page.getByRole('button', { name: /^\s*log ?in\s*$/i });
        this.accountLockedNotice = page.getByText(/account.*locked|Unlock Account/i);
        this.unlockAccountLink   = page.getByRole('link', { name: /Unlock Account/i })
            .or(page.getByText(/Unlock Account/i)).first();

        this.functionOtpTab        = page.getByRole('tab', { name: /Function OTP/i })
            .or(page.getByText(/^\s*Function OTP\s*$/i)).first();
        this.firstRowOptionsButton = page.locator('#otp-configurations-list-row-options-button').first();
        this.editOperationsMenuItem = page.getByRole('button', { name: /Edit Operations/i })
            .or(page.locator('.dropdown-item:visible', { hasText: /Edit Operations/i })).first();

        this.operationsModal        = page.locator('#operations-modal-container');
        this.operationsModalHeader  = page.locator('#operations-modal-header')
            .or(this.operationsModal.getByText(/All Operations/i)).first();
        this.operationsModalCloseIcon = page.locator('#operations-modal-close-icon');

        this.permissionOverlay = page.locator('#modal_permissionOverlayModal, app-permission-overlay');
    }

    /**
     * The admin SPA's location-permission overlay. It sits on top of every
     * screen and swallows pointer/keyboard events until location is granted —
     * with `createAdminContext()` it never mounts, but dismiss it defensively.
     */
    private async dismissPermissionOverlay(): Promise<void> {
        if (!(await this.permissionOverlay.first().isVisible().catch(() => false))) return;
        const allow = this.permissionOverlay
            .getByRole('button', { name: /allow|approve|enable|grant|continue|ok/i }).first();
        await allow.click({ timeout: 3000 }).catch(() => { /* fall through */ });
        await this.permissionOverlay.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { /* */ });
    }

    /** Fills a field and verifies the value landed, retyping once if it didn't. */
    private async typeExactly(field: Locator, value: string): Promise<void> {
        await field.click();
        await field.fill(value);
        if ((await field.inputValue()) !== value) {
            await field.fill('');
            await field.pressSequentially(value, { delay: 40 });
        }
    }

    /**
     * Navigates to `url` with the HTTP cache disabled first (a genuine hard
     * refresh — Ctrl+Shift+R, not just `page.goto`/`page.reload`, which are
     * both still allowed to serve a cached bundle). The admin SPA occasionally
     * hangs on a blank bootstrap on dev; a stale cached JS bundle is one
     * plausible cause (it's also exactly how a login flow could silently miss
     * a newly-added step like the OTP screen this class's `login()` now
     * handles — see its own comment). Relies on CDP (`newCDPSession`), which
     * is only available on Chromium — safe here since playwright.config.ts's
     * one project is `msedge`.
     */
    private async hardRefresh(url: string): Promise<void> {
        const client = await this.page.context().newCDPSession(this.page);
        await client.send('Network.setCacheDisabled', { cacheDisabled: true });
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    /** Logs into the admin SPA and lands on the authenticated shell. */
    async login(mobile: string = ADMIN_MOBILE, password: string = ADMIN_PASSWORD): Promise<void> {
        // `domcontentloaded` (not `networkidle`) — the page keeps analytics
        // beacons in flight, so idle can be slow/never; wait on the fields.
        // The admin SPA occasionally hangs on a blank bootstrap on dev — one
        // reload recovers it, so try the nav twice before giving up. Each
        // attempt is a hard refresh (see `hardRefresh`), not a plain `goto`.
        let formReady = false;
        for (let attempt = 1; attempt <= 2 && !formReady; attempt++) {
            await this.hardRefresh(ADMIN_LOGIN_URL);
            formReady = await this.usernameInput.waitFor({ state: 'visible', timeout: 30000 })
                .then(() => true)
                .catch(() => false);
        }
        if (!formReady) {
            throw new Error(
                'Admin login form never rendered — the admin SPA appears to be down on this ' +
                `environment (blank bootstrap at ${ADMIN_LOGIN_URL}).`,
            );
        }
        await this.passwordInput.waitFor({ state: 'visible', timeout: 10000 });
        await this.dismissPermissionOverlay();

        await this.typeExactly(this.usernameInput, mobile);
        await this.typeExactly(this.passwordInput, password);
        await expect(
            this.usernameInput,
            'admin username field did not accept the full value before submit',
        ).toHaveValue(mobile);
        await expect(
            this.passwordInput,
            'admin password field did not accept the full value before submit',
        ).toHaveValue(password);

        // Key the outcome off the sign-in response rather than DOM text — the
        // gateway answers 423 when the account is locked (repeated bad logins),
        // and the SPA can briefly bounce through a non-auth URL before landing
        // back on the login page, which would fool a plain waitForURL.
        const signinResponse = this.page.waitForResponse(
            r => /\/auth\/signin/.test(r.url()) && r.request().method() === 'POST',
            { timeout: 45000 },
        ).catch(() => null);

        await this.loginButton.click();

        const response = await signinResponse;
        if (response && response.status() === 423) {
            throw new Error(
                `Admin login for ${mobile} was refused — the account is LOCKED (HTTP 423), ` +
                'usually from repeated bad-password attempts. Unlock it via the "Unlock Account" ' +
                'link on the admin login page, then re-run.',
            );
        }
        if (response && response.status() >= 400) {
            throw new Error(`Admin login for ${mobile} failed — /auth/signin returned ${response.status()}.`);
        }

        // This account started requiring a 6-box OTP step after Login is
        // clicked (confirmed live 2026-09-22 — previously it didn't, and this
        // method had no OTP handling at all, which just hung until the
        // "reach the admin shell" timeout below with the OTP screen sitting
        // unfilled). Reuses the same widget/fill pattern as every other OTP
        // screen in the app (see OtpPage.ts) since this one's boxes share the
        // identical "One time password input" accessible name.
        const otp = new OtpPage(this.page);
        const otpShown = await otp.inputs.first()
            .waitFor({ state: 'visible', timeout: 10000 })
            .then(() => true)
            .catch(() => false);
        if (otpShown) {
            await otp.fillAndVerify(ADMIN_OTP_CODE);
        }

        const landed = await this.page
            .waitForURL(url => /\/admin\/main\//.test(url.toString()), { timeout: 30000 })
            .then(() => true)
            .catch(() => false);
        if (!landed) {
            const lockedHint = await this.accountLockedNotice.isVisible().catch(() => false);
            throw new Error(
                `Admin login for ${mobile} did not reach the admin shell (still on ${this.page.url()}). ` +
                (lockedHint
                    ? 'The login page is showing an "Unlock Account" prompt — the account is locked.'
                    : 'Check the credentials and that the admin SPA / gateway-dev are healthy.'),
            );
        }
    }

    /** Opens the OTP Configuration screen (defaults to the Function OTP tab). */
    async gotoOtpConfiguration(): Promise<void> {
        await this.page.goto(ADMIN_OTP_CONFIG_URL, { waitUntil: 'networkidle' });
        await expect(this.firstRowOptionsButton).toBeVisible({ timeout: 20000 });
    }

    /**
     * Opens the first (default) OTP setting's "Edit Operations" modal — the
     * "All Operations" list of per-operation checkboxes.
     */
    async openFirstSettingOperations(): Promise<void> {
        await this.firstRowOptionsButton.click();
        await this.editOperationsMenuItem.click();
        await expect(this.operationsModal).toBeVisible({ timeout: 15000 });
    }

    /** The checkbox for a given OTP operation inside the open operations modal. */
    operationCheckbox(operationCode: string): Locator {
        return this.operationsModal
            .locator('.row', { has: this.page.locator(`#input_type_text_name_standalone_${operationCode}`) })
            .locator('input[type="checkbox"]');
    }

    /**
     * Asserts an operation is bound to this OTP setting and locked there:
     * its checkbox is checked and disabled (not editable).
     */
    async expectOperationLockedOn(operationCode: string): Promise<void> {
        const checkbox = this.operationCheckbox(operationCode);
        await expect(checkbox, `${operationCode} operation checkbox is present`).toHaveCount(1);
        await expect(checkbox, `${operationCode} OTP is enabled`).toBeChecked();
        await expect(checkbox, `${operationCode} OTP assignment is not editable`).toBeDisabled();
        expect(await checkbox.isEditable(), `${operationCode} checkbox reports non-editable`).toBe(false);
    }
}
