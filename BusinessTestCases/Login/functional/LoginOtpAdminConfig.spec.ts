import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { AdminOtpConfigPage, OTP_OPERATION, createAdminContext } from '../../pageElements/Shared/AdminOtpConfigPage';

// ─────────────────────────────────────────────────────────────────────────────
// Login ⇄ Admin OTP configuration integration.
//
// The Admin Portal (System Configurations → OTP → Function OTP) governs which
// OTP *setting* each operation uses. LOGIN is a platform-mandated OTP operation:
// in the default setting its checkbox must be present, checked, and disabled —
// an admin can neither turn LOGIN OTP off nor move it off a setting from this
// screen. This guards that the "Edit Operations" modal keeps LOGIN locked on.
//
// Own-browser admin login (the admin SPA is a separate app from the merchant
// portal, so session.json / the fixtures.ts `page` don't apply) — same
// bespoke-beforeAll pattern BankTransfer/Products already use.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — Admin OTP Configuration', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(120000);

    let context: BrowserContext;
    let page: Page;
    let adminOtp: AdminOtpConfigPage;

    test.beforeAll(async ({ browser }) => {
        // Geolocation must be granted up front or the admin SPA's permission
        // overlay blocks the login form — browser.newPage() wouldn't inherit it.
        context = await createAdminContext(browser);
        page = await context.newPage();
        adminOtp = new AdminOtpConfigPage(page);
        await adminOtp.login();
        await adminOtp.gotoOtpConfiguration();
        await adminOtp.openFirstSettingOperations();
    });

    test.afterAll(async () => {
        await context.close();
    });

    test('LOGIN OTP operation is locked on (checked and not editable) in the default OTP setting', async () => {
        await expect(adminOtp.operationsModalHeader).toBeVisible();
        await adminOtp.expectOperationLockedOn(OTP_OPERATION.LOGIN);
    });
});
