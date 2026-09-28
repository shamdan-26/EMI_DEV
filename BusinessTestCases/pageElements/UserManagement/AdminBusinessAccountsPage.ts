import { type Page, type Locator, expect } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'https://dev.majdpay.com';

/** Admin Portal → Manage Users → Accounts → Business ("Accounts List", Business tab). */
export const ADMIN_BUSINESS_ACCOUNTS_URL = `${BASE_URL}/admin/main/account-management/accounts-list`;

/**
 * Admin Portal → Manage Users → Accounts → Business. Confirmed live 2026-09-28
 * against the dev admin SPA.
 *
 * The filter panel ("Filter Here...") starts collapsed and must be expanded
 * before its inputs exist in the DOM. Fields are page-authored `id`s (this
 * screen isn't in QA-DATA-TESTID-HANDOFF.md):
 *   #input_type_text_name_companyNumber_companynumber
 *   #input_type_text_name_mobileNumber_mobilenumber
 *   #input_type_text_name_unifiedNumber_unifiednumber
 *
 * **Confirmed-live defect**: the Mobile Number filter returns "No Data Found"
 * even for a mobile number that demonstrably belongs to a listed account
 * (verified by cross-checking the same account via Company Number, whose
 * filter works correctly). Use `searchByCompanyNumber` instead — Company
 * Number is what `RegistrationFullDetail.tenant_number` (RegistrationHelper.ts)
 * captures for a newly registered business, and it's what this app's own
 * login screen calls "Company Number" everywhere else. Do not switch this
 * page object's default search to Mobile Number without re-confirming the
 * defect is fixed.
 *
 * The results grid is a div-based layout, not a real `<table>`: each row is
 * a `.rows` container wrapping an `<app-merchant-biller-row>` component.
 */
export class AdminBusinessAccountsPage {
    readonly page: Page;

    readonly filterToggle: Locator;
    readonly companyNumberInput: Locator;
    readonly mobileNumberInput: Locator;
    readonly unifiedNumberInput: Locator;
    readonly searchButton: Locator;
    readonly clearFilterButton: Locator;

    readonly resultsContainer: Locator;
    readonly accountRows: Locator;
    readonly noDataText: Locator;
    /** e.g. "Total Users: 1" — only rendered once a search has returned at least one row. */
    readonly totalUsersLabel: Locator;

    constructor(page: Page) {
        this.page = page;

        this.filterToggle = page.getByText(/^\s*Filter Here\.{3}\s*$/i);
        this.companyNumberInput = page.locator('#input_type_text_name_companyNumber_companynumber');
        this.mobileNumberInput  = page.locator('#input_type_text_name_mobileNumber_mobilenumber');
        this.unifiedNumberInput = page.locator('#input_type_text_name_unifiedNumber_unifiednumber');
        this.searchButton      = page.getByRole('button', { name: /^\s*search\s*$/i });
        this.clearFilterButton = page.getByRole('button', { name: /clear filter/i });

        this.resultsContainer = page.locator('.table-container');
        this.accountRows      = this.resultsContainer.locator('.rows');
        this.noDataText       = this.resultsContainer.getByText(/No Data Found/i);
        this.totalUsersLabel  = page.locator('.total-pages');
    }

    /** Navigates via Manage Users → Accounts → Business (not a direct deep link), so a broken sidebar path fails this step rather than being silently bypassed. */
    async gotoViaSidebar(): Promise<void> {
        await this.page.getByRole('link', { name: /^\s*Manage Users\s*$/i })
            .or(this.page.getByText(/^\s*Manage Users\s*$/i)).first().click();
        await this.page.getByText(/^\s*Accounts\s*$/i).first().click();
        await this.page.getByText(/^\s*Business\s*$/i).first().click();
        await expect(this.filterToggle).toBeVisible({ timeout: 20000 });
    }

    private async ensureFilterExpanded(): Promise<void> {
        const expanded = await this.companyNumberInput.isVisible().catch(() => false);
        if (expanded) return;
        await this.filterToggle.click();
        await this.companyNumberInput.waitFor({ state: 'visible', timeout: 10000 });
    }

    /**
     * Filters the Business accounts list by Company Number (e.g. `detail.tenant_number`
     * from `getFullRegistrationDetailByMobileFromSql`) and waits for the grid to settle.
     */
    async searchByCompanyNumber(companyNumber: string): Promise<void> {
        await this.ensureFilterExpanded();
        await this.companyNumberInput.fill(companyNumber);
        await this.searchButton.click();
        await Promise.race([
            this.accountRows.first().waitFor({ state: 'visible', timeout: 20000 }),
            this.noDataText.waitFor({ state: 'visible', timeout: 20000 }),
        ]).catch(() => { /* fall through to the caller's own assertion */ });
    }

    /**
     * Asserts exactly one account is listed for this Company Number — the
     * expected outcome right after a business finishes registration, since a
     * Company Number is unique per account.
     */
    async expectAccountListed(companyNumber: string): Promise<void> {
        await this.searchByCompanyNumber(companyNumber);
        await expect(
            this.noDataText,
            `Business account for Company Number ${companyNumber} was not found under Manage Users → Accounts → Business`,
        ).not.toBeVisible();
        await expect(this.accountRows).toHaveCount(1);
    }
}
