import { test, expect } from '@playwright/test';
import { HOME_URL, loginToTopup, type TopupSession } from '../TopupHelper';
import { HomepageSidebarPage } from '../../pageElements/Shared/HomepageSidebarPage';

// Navigation — the two entry points that land on Topup. Maps to
// docs/manual-test-cases/Topup.md section A (TUP-01, TUP-02); TUP-03/TUP-04
// (title/subtitle, direct-URL-without-auth) are already covered by
// ui/TopupFormUI.spec.ts and functional/TopupSecurity.spec.ts respectively.
//
// Every other Topup file's own `beforeEach` (`gotoTopupScreen`) already
// clicks the homepage quick-action card to reach the form, so TUP-02 is
// exercised implicitly hundreds of times over — but never asserted as its
// own case, and the sidebar link (TUP-01) isn't exercised anywhere at all.

test.describe('Topup – Navigation', { tag: ['@topup', '@functional'], annotation: [{ type: 'feature', description: 'Topup' }, { type: 'layer', description: 'functional' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(60000);

    let session: TopupSession;
    let sidebar: HomepageSidebarPage;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser);
        sidebar = new HomepageSidebarPage(session.page);
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test.beforeEach(async () => {
        await session.page.goto(HOME_URL);
        await session.page.waitForLoadState('domcontentloaded');
    });

    /** TUP-01 */
    test('sidebar "Topup" link opens the Topup page', { annotation: [{ type: 'testcase', description: "TUP-01: Sidebar link opens Topup" }] }, async () => {
        const { page, topup } = session;
        await sidebar.topupSidebarLink.click();
        await page.waitForURL(/\/transfer\/top-up/, { timeout: 15000 });
        await expect(topup.inputAmount).toBeVisible({ timeout: 15000 });
    });

    /** TUP-02 */
    test('homepage quick action "Add money via card" opens the same Topup page', { annotation: [{ type: 'testcase', description: "TUP-02: Homepage quick action opens Topup" }] }, async () => {
        const { page, topup, quickActions } = session;
        await quickActions.quickActionTopupCard.click();
        await page.waitForURL(/\/transfer\/top-up/, { timeout: 15000 });
        await expect(topup.inputAmount).toBeVisible({ timeout: 15000 });
    });
});
