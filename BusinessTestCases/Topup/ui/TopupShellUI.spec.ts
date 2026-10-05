import { test, expect } from '@playwright/test';
import { loginToTopup, gotoTopupScreen, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — the app shell around the Topup screen: RTL sidebar, top header and profile dropdown.
// Assertions check visibility/non-emptiness or bilingual patterns rather than
// guessed Arabic copy — the app renders Arabic by default on dev. Shared setup:
// see TopupHelper.ts (loginToTopup / gotoTopupScreen / findTopupCase).

test.describe('Topup – UI – Sidebar, header and profile menu', { tag: ['@topup', '@ui'], annotation: [{ type: 'feature', description: 'Topup' }, { type: 'layer', description: 'ui' }] }, () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(150000);

    let session: TopupSession;

    test.beforeAll(async ({ browser }) => {
        session = await loginToTopup(browser, TOPUP_UI_ACCOUNT);
    });

    test.afterAll(async () => {
        await session.page.close();
    });

    test.beforeEach(async () => {
        await gotoTopupScreen(session);
    });

    // Runs even when the test fails, so the gateway popup never leaks into the next test.
    test.afterEach(async () => {
        for (const stray of session.page.context().pages()) {
            if (stray !== session.page) await stray.close().catch(() => { /* already closed */ });
        }
        session.topup.resetActivePage();
    });

    // ───────────────────────── Sidebar (RTL) ─────────────────────────

    test('sidebar shows the MajdPay logo and the collapse button', async () => {
        const { shell } = session;
        await expect(shell.sidebar).toBeVisible();
        await expect(shell.logos.first()).toBeVisible();
        await expect(shell.sidebarLogo).toBeVisible();
        await expect(shell.collapseButton).toBeVisible();
    });

    test('the collapse button shrinks the sidebar and expands it again', async () => {
        const { shell } = session;
        const width = async () => (await shell.sidebar.boundingBox())?.width ?? 0;
        const expanded = await width();
        expect(expanded).toBeGreaterThan(200);
        try {
            await shell.collapseButton.click();
            await expect.poll(width, { timeout: 5000 }).toBeLessThan(expanded);
        } finally {
            // Leave the sidebar expanded for whatever test runs next.
            if ((await width()) < expanded) await shell.collapseButton.click();
        }
        await expect.poll(width, { timeout: 5000 }).toBe(expanded);
    });

    test('sidebar top-level links point to their expected routes', { annotation: [{ type: 'testcase', description: "TUP-01: Sidebar link opens Topup" }] }, async () => {
        const { shell } = session;
        const expected: [typeof shell.homeLink, RegExp][] = [
            [shell.homeLink,         /\/business\/main\/home$/],
            [shell.transactionsLink, /\/transactions$/],
            [shell.topupLink,        /\/transfer\/top-up$/],
            [shell.billsLink,        /\/bills\/bill-report$/],
            [shell.paymentLinksLink, /\/payment-links\/manage$/],
            [shell.subWalletsLink,   /\/sub-wallets$/],
            [shell.invoiceItemsLink, /\/products-management$/],
            [shell.productsLink,     /\/products$/],
            [shell.groupsRolesLink,  /\/groups-management$/],
            [shell.cardManagementLink, /\/card-management$/],
        ];
        for (const [link, href] of expected) {
            await expect(link).toBeVisible();
            await expect(link).toHaveAttribute('href', href);
        }
    });

    test('Add Funds is the active (highlighted) sidebar entry on this screen', { annotation: [{ type: 'testcase', description: "TUP-01: Sidebar link opens Topup" }] }, async () => {
        const { shell, page } = session;
        await expect(shell.topupLink).toBeVisible();
        // Whole-token match: a bare /active/ also hits Material's
        // "mat-mdc-list-item-interactive", present on every nav item.
        const activeClass = /(^|\s)(active|[\w-]*--activated)(\s|$)/i;
        await expect(shell.topupLink).toHaveClass(activeClass);
        await expect(shell.homeLink).not.toHaveClass(activeClass);
        await expect(page).toHaveURL(/\/transfer\/top-up/);
    });

    test('sidebar section labels (Funds / Management / Products) are shown', async () => {
        const { shell } = session;
        await expect(shell.sectionLabels).toHaveCount(3);
    });

    test('Transfer panel expands to Withdraw, Wallet Transfer and a "coming soon" International Transfer', async () => {
        const { shell } = session;
        await expect(shell.withdrawLink).toBeHidden();
        await shell.expandPanel(shell.transferPanel);

        await expect(shell.withdrawLink).toBeVisible();
        await expect(shell.withdrawLink).toHaveAttribute('href', /\/transfer\/bank-transfer$/);
        await expect(shell.walletTransferLink).toHaveAttribute('href', /\/transfer\/wallet-to-wallet-transfer$/);
        await expect(shell.internationalTransferItem).toBeVisible();
        await expect(shell.internationalTransferItem).not.toHaveAttribute('href', /.+/);
        await expect(shell.internationalTransferItem).toContainText(/قريباً|soon/i);
    });

    test('Account Management panel expands to User and Beneficiary Management', async () => {
        const { shell } = session;
        await expect(shell.userManagementLink).toBeHidden();
        await shell.expandPanel(shell.accountManagementPanel);

        await expect(shell.userManagementLink).toHaveAttribute('href', /\/user-management$/);
        await expect(shell.beneficiaryLink).toHaveAttribute('href', /\/beneficiary$/);
    });

    test('SADAD is shown as a disabled "coming soon" item with no link', async () => {
        const { shell } = session;
        await expect(shell.sadadItem).toBeVisible();
        await expect(shell.sadadItem).toContainText(/قريباً|soon/i);
        await expect(shell.sadadItem).not.toHaveAttribute('href', /.+/);
    });

    test('clicking the disabled SADAD / International Transfer items does not navigate away', async () => {
        const { shell, page } = session;
        const before = page.url();
        await shell.sadadItem.click({ force: true });
        await expect(page).toHaveURL(before);

        await shell.expandPanel(shell.transferPanel);
        await shell.internationalTransferItem.click({ force: true });
        await expect(page).toHaveURL(before);
    });

    // The disabled items are only disabled visually (no href), so confirm they
    // can't be activated from the keyboard either. Direct-URL access isn't
    // tested: these items have no route to type.
    test('the disabled SADAD item does nothing when activated from the keyboard', async () => {
        const { shell, page } = session;
        const before = page.url();
        await shell.sadadItem.focus().catch(() => { /* not focusable — that's fine */ });
        await page.keyboard.press('Enter');
        await page.keyboard.press('Space');
        await expect(page).toHaveURL(before);
    });

    test('sidebar footer shows the user-settings button and the logout button', async () => {
        const { shell } = session;
        await expect(shell.userSettingsButton).toBeVisible();
        await expect(shell.logoutButton).toBeVisible();
    });

    // ───────────────────────── Top header & profile dropdown ─────────────────────────

    test('header shows the Add Funds title, notifications bell and profile avatar', async () => {
        const { shell } = session;
        await expect(shell.headerTitle).toBeVisible();
        await expect(shell.notificationsBell).toBeVisible();
        await expect(shell.profileAvatar).toBeVisible();
        // The hamburger is mobile-only — hidden at desktop width.
        await expect(shell.mobileMenuToggle).toBeHidden();
    });

    // The hamburger is hidden at desktop width (asserted above) and must show on a phone-width viewport.
    test('the mobile menu toggle appears at phone width', async () => {
        const { page, shell } = session;
        const original = page.viewportSize();
        try {
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(shell.mobileMenuToggle).toBeVisible();
        } finally {
            await page.setViewportSize(original ?? { width: 1280, height: 720 });
        }
    });

    // KNOWN BUG (accessibility): the notifications bell has no aria-label, so
    // screen readers can't name it. Un-skip once it has an accessible name.
    test.skip('the notifications bell has an accessible name', async () => {
        const { shell } = session;
        await expect(shell.notificationsBell).toHaveAttribute('aria-label', /.+/);
    });

    test('profile dropdown is closed until the avatar is clicked', async () => {
        const { shell } = session;
        await expect(shell.profileMenu).toBeHidden();
        await shell.openProfileMenu();
        await expect(shell.profileMenu).toBeVisible();
    });

    test('profile dropdown lists Settings, Profile, Notifications, Dark Mode, Language, Wallet Setup and Logout', async () => {
        const { shell } = session;
        await shell.openProfileMenu();

        await expect(shell.profileSettingsHeading).toBeVisible();
        await expect(shell.profileLink).toBeVisible();
        await expect(shell.notificationsToggle).toBeAttached();
        await expect(shell.darkModeToggle).toBeAttached();
        await expect(shell.languageButton).toBeVisible();
        await expect(shell.languageButton).toContainText(/العربية|Arabic/i);
        await expect(shell.walletSetupLink).toBeVisible();
        await expect(shell.profileLogoutButton).toBeVisible();
        // Confirmed live 2026-10-04: the dropdown itself lists only the actions above —
        // the user's name/email/phone are not rendered inside it for this account.

        await shell.closeProfileMenu();
    });
});
