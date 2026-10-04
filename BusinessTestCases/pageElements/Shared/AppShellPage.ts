import { type Page, type Locator } from '@playwright/test';

/**
 * The authenticated app shell around every business-portal screen: the RTL
 * sidebar (by its `sideNav-*` ids) and the top header with its profile
 * dropdown. Complements `HomepageSidebarPage`, which locates sidebar entries
 * by role/name — this one pins each entry to its stable `sideNav-*` id so a
 * test can assert order, target and active state without depending on copy.
 *
 * Every id below is matched as either `id` or `data-testid` — the handoff
 * lists them as bare "IDs" without saying which attribute carries them.
 */
export class AppShellPage {
    readonly page: Page;

    // ---------- Sidebar ----------
    readonly sidebar: Locator;
    readonly logos: Locator;
    readonly collapseButton: Locator;
    readonly sectionLabels: Locator;

    readonly homeLink: Locator;
    readonly transactionsLink: Locator;
    readonly topupLink: Locator;
    readonly transferPanel: Locator;
    readonly withdrawLink: Locator;
    readonly walletTransferLink: Locator;
    readonly internationalTransferItem: Locator;
    readonly billsLink: Locator;
    readonly paymentLinksLink: Locator;
    readonly subWalletsLink: Locator;
    readonly sadadItem: Locator;
    readonly accountManagementPanel: Locator;
    readonly userManagementLink: Locator;
    readonly beneficiaryLink: Locator;
    readonly invoiceItemsLink: Locator;
    readonly productsLink: Locator;
    readonly groupsRolesLink: Locator;
    readonly cardManagementLink: Locator;
    readonly userSettingsButton: Locator;
    readonly logoutButton: Locator;

    // ---------- Top header ----------
    readonly sidebarLogo: Locator;
    readonly headerTitle: Locator;
    readonly mobileMenuToggle: Locator;
    readonly notificationsBell: Locator;
    readonly profileAvatar: Locator;

    // ---------- Profile dropdown (hidden until opened) ----------
    readonly profileMenu: Locator;
    readonly profileSettingsHeading: Locator;
    readonly profileLink: Locator;
    readonly notificationsToggle: Locator;
    readonly darkModeToggle: Locator;
    readonly languageButton: Locator;
    readonly languageOptionEnglish: Locator;
    readonly languageOptionArabic: Locator;
    readonly walletSetupLink: Locator;
    readonly profileLogoutButton: Locator;

    constructor(page: Page) {
        this.page = page;

        const byId = (id: string): Locator => page.locator(`[id="${id}"], [data-testid="${id}"]`);

        this.sidebar        = page.locator('#sideNav-sidenav');
        this.logos          = this.sidebar.locator('img[alt*="MajdPay" i], img[alt*="MJD" i]');
        // Confirmed live 2026-10-04: `div#sideNav-toggle-button.side-nav-btn` wrapping the `#sideNav-toggle-icon` chevron.
        this.collapseButton = byId('sideNav-toggle-button');
        // "المنتجات" is both a section label and a nav-link name — match only
        // leaf elements that are NOT inside a link, so the link isn't double-counted.
        this.sectionLabels  = this.sidebar.locator(
            'xpath=.//*[not(*) and not(ancestor-or-self::a) and '
            + '(normalize-space(.)="الأموال" or normalize-space(.)="إدارة" or normalize-space(.)="المنتجات")]',
        );

        this.homeLink                  = byId('sideNav-menu-item-0');
        this.transactionsLink          = byId('sideNav-menu-item-1');
        this.topupLink                 = byId('sideNav-menu-item-2');
        this.transferPanel             = byId('sideNav-expansion-panel-link-3');
        this.withdrawLink              = byId('sideNav-child-menu-item-3-0');
        this.walletTransferLink        = byId('sideNav-child-menu-item-3-1');
        this.internationalTransferItem = byId('sideNav-child-menu-item-3-2');
        this.billsLink                 = byId('sideNav-menu-item-4');
        this.paymentLinksLink          = byId('sideNav-menu-item-5');
        this.subWalletsLink            = byId('sideNav-menu-item-6');
        this.sadadItem                 = byId('sideNav-menu-item-7');
        this.accountManagementPanel    = byId('sideNav-expansion-panel-link-8');
        this.userManagementLink        = byId('sideNav-child-menu-item-8-0');
        this.beneficiaryLink           = byId('sideNav-child-menu-item-8-1');
        this.invoiceItemsLink          = byId('sideNav-menu-item-9');
        this.productsLink              = byId('sideNav-menu-item-10');
        this.groupsRolesLink           = byId('sideNav-menu-item-11');
        this.cardManagementLink        = byId('sideNav-menu-item-12');
        // The id is duplicated: a <button> in the sidebar footer and a <div> in
        // the profile dropdown — scope to the sidebar's.
        this.userSettingsButton        = this.sidebar.locator('[id="userSettings-image-container"], [data-testid="userSettings-image-container"]');
        this.logoutButton              = this.sidebar.locator('[id="logout"], [data-testid="logout"]');

        this.sidebarLogo       = byId('sideNav-logo');
        // The header's page title lives in the top <nav> that also holds the profile avatar.
        this.headerTitle       = page.locator('nav').filter({ has: page.locator('[id="ddl_profile"]') })
            .getByText(/إضافة الأموال|Add Funds/).first();
        this.mobileMenuToggle  = byId('header-menu-toggle');
        this.notificationsBell = page.locator('.ai-icon').first();
        this.profileAvatar     = byId('ddl_profile');

        this.profileMenu            = page.locator('.dropdown-menu.show, [aria-labelledby="ddl_profile"]').first();
        this.profileSettingsHeading = this.profileMenu.getByText(/الإعدادات|Settings/);
        this.profileLink            = this.profileMenu.getByText(/الملف الشخصي|Profile/);
        // Both switches share the duplicate id `toggle-button-input`, so they
        // are addressed by position inside the menu: notifications first, dark
        // mode second.
        this.notificationsToggle = this.profileMenu.locator('[id="toggle-button-input"]').nth(0);
        this.darkModeToggle      = this.profileMenu.locator('[id="toggle-button-input"]').nth(1);
        this.languageButton      = byId('userSettings-language-button');
        // The button opens a picker (confirmed live 2026-10-04) listing "ENG" and "العربية".
        // The Arabic label also appears on the button itself, so take the last match (the picker's).
        this.languageOptionEnglish = page.getByText(/^\s*ENG\s*$/);
        this.languageOptionArabic  = page.getByText(/^\s*العربية\s*$/).last();
        this.walletSetupLink     = this.profileMenu.getByText(/تهيئة المحفظة|Wallet Setup/);
        this.profileLogoutButton = this.profileMenu.getByText(/تسجيل الخروج|Logout/);
    }

    /** Opens the header profile dropdown. */
    async openProfileMenu(): Promise<void> {
        await this.profileAvatar.click();
        await this.profileMenu.waitFor({ state: 'visible', timeout: 5000 });
    }

    /** Opens the profile menu, then its language picker, and chooses `language`. */
    async chooseLanguage(language: 'en' | 'ar'): Promise<void> {
        await this.openProfileMenu();
        await this.languageButton.click();
        await (language === 'en' ? this.languageOptionEnglish : this.languageOptionArabic).click();
    }

    /** Closes the dropdown again so it can't leak into the next test. */
    async closeProfileMenu(): Promise<void> {
        if (await this.profileMenu.isVisible()) await this.page.keyboard.press('Escape');
    }

    /** Opens the "Transfer" / "Account Management" accordion panel so its hidden child links become visible. */
    async expandPanel(panel: Locator): Promise<void> {
        await panel.click();
    }
}
