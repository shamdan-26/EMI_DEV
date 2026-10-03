import { type Page, type Locator, expect } from '@playwright/test';
import { AdminOtpConfigPage } from '../Shared/AdminOtpConfigPage';

/**
 * Admin Portal → Commission Management → Default Commission
 * (`/admin/main/commission/defult-commission` — "Defult" is the product's own
 * spelling, not a typo introduced here).
 *
 * Locators are page-authored `id`s read off the live dev DOM (2026-09-15) —
 * the admin portal is not in QA-DATA-TESTID-HANDOFF.md. Row ids are NOT
 * unique per row (every `app-defult-commission-row` instance repeats the same
 * inner ids, e.g. `#default-commission-row-transaction-type`) — only the row
 * host itself carries a per-index id (`#default-commission-row-0`, `-1`, ...).
 * Scoping every lookup through a row `Locator` (Playwright queries descendants
 * by selector, unlike `document.getElementById`) is what makes this safe.
 *
 * Key anchors:
 *   #default-commission-rows                  list container
 *   app-defult-commission-row                 one row per commission
 *   #default-commission-row-transaction-type  row's transaction-type cell
 *   #default-commission-row-status-button     row's Active/Disable toggle
 *   #default-commission-row-dropdown-menu li  Activate/Disable menu item
 *   #user-commissions-row-edit                row's edit-pencil icon
 *   #modal_default                            the add/edit commission modal overlay
 *   #default-commission-choose-transaction-modal   "Choose Commission Type" step-1 modal
 *
 * This page object only handles navigation/login. Use `createAdminContext` +
 * `AdminOtpConfigPage.login()` from `Shared/AdminOtpConfigPage` to authenticate
 * first (see that file's header comment) — the admin SPA's login form is
 * identical regardless of which admin screen a spec is exercising, so specs
 * reuse it rather than duplicating the login flow here.
 */

const BASE_URL = process.env['BASE_URL'] ?? 'https://dev.majdpay.com';
const API_BASE = process.env['API_BASE_URL'] ?? 'https://gateway-dev.majdpay.com';

export const DEFAULT_COMMISSION_URL = `${BASE_URL}/admin/main/commission/defult-commission`;

/**
 * Admin Portal → Commission Management → Accounts Commission
 * (`/admin/main/commission/accounts-list` → pick an account →
 * `/admin/main/commission/account-commission?...&a=<internal id>`).
 *
 * A per-account override list one level below Default Commission: each
 * business account (looked up here by its own mobile number) gets its own
 * "Add New Commission" wizard targeting only that account. Confirmed live
 * 2026-09-27 to reuse the exact same `#modal_default` /
 * `#add-edit-commission-modal-form` component Default Commission uses, with
 * one difference — the Min/Max Amount field ids carry `minValue`/`maxValue`
 * here vs Default's `min`/`max` (`minimumAmountInput`/`maximumAmountInput`
 * below match both by suffix). The "Choose <Category> Transaction" step only
 * ever offers the transaction type(s) that specific account is eligible for
 * (confirmed live: a Merchant account offered only "Merchant Cashin" under
 * Cash-In, and separately only "Biller Bank Cashin" for a different
 * business account under the same mobile number — never every category's
 * full checkbox list Default Commission's wizard shows).
 *
 * `openAccountCommissionsByMobile` drives the in-app filter form (confirmed
 * live, via network capture, to correctly call `GET .../profiles/business/
 * pag?...&companyNumber=...&mobileNumber=...` and narrow to the matching
 * account) — see that method's own header comment for why earlier attempts
 * at this wrongly concluded the filter itself was broken.
 */
export const ACCOUNTS_LIST_URL = `${BASE_URL}/admin/main/commission/accounts-list`;

/**
 * Raw shape of one entry from `GET /api/v1/default-commissions` (confirmed
 * live 2026-09-25). Note `transactionTypeCode` is a numeric string (e.g.
 * "102003"), never the friendly name the grid tries to show — the backend
 * has no concept of "Biller Bank Cashin" at all, which is exactly why the
 * grid's own name-lookup can fail for some rows (rendering the raw code
 * instead) and why a UI text-scan for that name can be unreliable in a way
 * this API lookup structurally can't be.
 */
export interface DefaultCommissionApiEntry {
    id: number;
    amountValue: number;
    min: number;
    max: number;
    transactionTypeCode: string;
    platformType: string; // lowercase: 'web' | 'app' | 'system'
    type: string; // 'PERCENTAGE' | 'FIXED'
    isActive: boolean;
}

/** Broad commission categories offered by the "Choose Commission Type" modal (step 1 of Add New). */
export const COMMISSION_CATEGORY = {
    BANK_TRANSFER: 'Bank Transfer',
    CASH_IN: 'Cash-In',
    WALLET_TO_WALLET_TRANSFER: 'Wallet To Wallet Transfer',
    WALLET_PAYMENT: 'Wallet Payment',
    BILL_PAYMENT: 'Bill Payment',
    SUB_WALLET_TRANSFER: 'Sub-Wallet Transfer',
    REVERSAL: 'Reversal',
    OTC_TRANSFER: 'OTC Transfer',
    CARD_TRANSACTIONS: 'Card Transactions',
} as const;

/**
 * Account types offered by step 2's "Choose <Category> Transaction" checkbox
 * list — confirmed for Bank Transfer (Customer/Merchant/Biller/Company Bank
 * Transfer); other categories are assumed to follow the same "<Account Type>
 * <thing>" naming, matched by prefix rather than an exact hand-typed string
 * (see `chooseAccountType`).
 */
export const ACCOUNT_TYPE = {
    CUSTOMER: 'Customer',
    MERCHANT: 'Merchant',
    BILLER: 'Biller',
    COMPANY: 'Company',
} as const;

export interface CommissionFormValues {
    platform: 'WEB' | 'APP' | 'SYSTEM';
    minimumAmount: string;
    maximumAmount: string;
    /** The commission value. Combine with `isPercentage` to say how it's interpreted. */
    value: string;
    /** Whether `value` is a percentage (toggle on) or a flat amount (toggle off). Defaults to true (the toggle's default state). */
    isPercentage?: boolean;
}

export class AdminCommissionManagementPage {
    readonly page: Page;

    readonly commissionManagementNavItem: Locator;
    readonly defaultCommissionNavLink: Locator;

    readonly addNewCommissionButton: Locator;
    readonly filterToggle: Locator;
    readonly clearFilterButton: Locator;
    readonly searchButton: Locator;

    readonly rowsContainer: Locator;
    readonly rows: Locator;
    readonly totalCommissionsLabel: Locator;
    readonly nextPageButton: Locator;
    readonly prevPageButton: Locator;

    readonly modalOverlay: Locator;
    readonly chooseTypeModal: Locator;
    readonly chooseTypeModalCloseIcon: Locator;

    /** Rows on the Accounts Commission (per-account) list — a distinct component/id-prefix from `rows` above. */
    readonly accountCommissionRows: Locator;

    /**
     * Headers off a real request the admin SPA itself sent to the gateway —
     * captured passively so direct API calls (`apiFetchAllCommissions` etc.)
     * can authenticate without us ever touching the token. The token lives
     * in localStorage, but every value there is CryptoJS `Salted__`-encrypted
     * with a key baked into the frontend bundle, so decrypting it ourselves
     * isn't practical or appropriate; `Authorization` alone also isn't
     * enough — `device-finger-print` looks like a signed composite that
     * embeds the token itself, and the gateway 401s without it (confirmed
     * live 2026-09-25). Relaying the browser's own already-formed headers
     * sidesteps needing to understand or reproduce that scheme at all.
     */
    private capturedApiHeaders: Record<string, string> | null = null;
    /** When the headers above were captured (`Date.now()`) — see `API_HEADERS_MAX_AGE_MS`. */
    private capturedApiHeadersAt = 0;
    /**
     * The captured JWT carries a real, short expiry (~18 minutes, confirmed
     * live 2026-09-25 by decoding one) — a single Topup Commission spec file
     * routinely runs well past that across its full serial suite. Refresh
     * proactively once headers are older than this, rather than waiting to
     * react to a 401 — a 401 on `apiSetActive` mid-test leaves the commission
     * row in whatever state the previous step left it, which is worse than
     * spending a few extra seconds re-logging in before that ever happens.
     */
    private static readonly API_HEADERS_MAX_AGE_MS = 10 * 60 * 1000;

    constructor(page: Page) {
        this.page = page;

        this.page.on('request', (req) => {
            if (!this.capturedApiHeaders && req.url().includes('gateway-') && req.headers()['authorization']) {
                this.capturedApiHeaders = req.headers();
                this.capturedApiHeadersAt = Date.now();
            }
        });

        this.commissionManagementNavItem = page.getByText(/Commission\s*Management/i).first();
        this.defaultCommissionNavLink = page.getByText(/Defult Commission|Default Commission/i).first();

        this.addNewCommissionButton = page.getByRole('button', { name: /Add New Commission/i });
        this.filterToggle = page.getByText(/Filter Here/i).first();
        this.clearFilterButton = page.getByRole('button', { name: /Clear Filter/i });
        this.searchButton = page.getByRole('button', { name: /^Search$/i });

        this.rowsContainer = page.locator('#default-commission-rows');
        this.rows = page.locator('app-defult-commission-row');
        this.totalCommissionsLabel = page.locator('.total-pages');
        this.nextPageButton = page.locator('#PAGINATOR_NEXT_PAGE_BTN');
        this.prevPageButton = page.locator('#PAGINATOR_PREVIOUS_PAGE_BTN');

        this.modalOverlay = page.locator('#modal_default');
        // Accounts Commission's step-1 modal carries its own distinct id
        // (`#choose-transaction-modal`) rather than Default Commission's
        // `#default-commission-choose-transaction-modal` (confirmed live
        // 2026-09-27) — only one of the two is ever present on a given
        // screen, so matching both here lets `chooseCommissionCategory`
        // serve both without a per-screen branch. Every inner id/placeholder
        // this class already relies on (e.g. `input[placeholder="Cash-In"]`)
        // was confirmed identical between the two modals.
        this.chooseTypeModal = page.locator('#default-commission-choose-transaction-modal, #choose-transaction-modal');
        this.chooseTypeModalCloseIcon = this.chooseTypeModal.locator('.close, [class*="close"]').first();

        this.accountCommissionRows = page.locator('app-user-commissions-row');
    }

    /** Waits (briefly) for the passive header capture above to have fired, then returns a clean copy. */
    private async ensureApiHeaders(forceRefresh = false): Promise<Record<string, string>> {
        const stale = this.capturedApiHeaders !== null
            && (Date.now() - this.capturedApiHeadersAt) > AdminCommissionManagementPage.API_HEADERS_MAX_AGE_MS;
        if (forceRefresh || stale) {
            // A plain reload isn't enough to renew this: `page.request`
            // calls bypass the Angular app's own HttpClient (and whatever
            // interceptor/silent-refresh it might have), so
            // `gotoDefaultCommission()` alone just re-renders the SPA shell
            // with the SAME still-expired token from localStorage (confirmed
            // live 2026-09-25: a retry with "refreshed" headers got the
            // identical 401 SESSION_INVALID). A real login is what actually
            // mints a new token — same remedy `recoverFromExpiredSession`
            // uses for the UI-dialog variant of this same problem.
            this.capturedApiHeaders = null;
            await new AdminOtpConfigPage(this.page).login();
            await this.gotoDefaultCommission();
        }
        for (let attempt = 0; attempt < 10 && !this.capturedApiHeaders; attempt++) {
            await this.page.waitForTimeout(500);
        }
        if (!this.capturedApiHeaders) {
            throw new Error(
                'No authenticated gateway request has been observed yet on this admin session — ' +
                'call gotoDefaultCommission() (or any other admin navigation) before an API call.',
            );
        }
        const headers = { ...this.capturedApiHeaders };
        delete headers['host'];
        delete headers['content-length'];
        delete headers['connection'];
        return headers;
    }

    /** All default-commission rows, across every page, straight from the API — see `DefaultCommissionApiEntry`'s header comment for why this is preferred over scanning the grid. */
    async apiFetchAllCommissions(): Promise<DefaultCommissionApiEntry[]> {
        let headers = await this.ensureApiHeaders();
        const all: DefaultCommissionApiEntry[] = [];
        for (let pageNum = 0; ; pageNum++) {
            let res = await this.page.request.get(`${API_BASE}/api/v1/default-commissions?page=${pageNum}&size=50`, { headers });
            if (res.status() === 401) {
                // Stale/expired captured headers — see `ensureApiHeaders`'s
                // forceRefresh comment. Retry once with a freshly captured set.
                headers = await this.ensureApiHeaders(true);
                res = await this.page.request.get(`${API_BASE}/api/v1/default-commissions?page=${pageNum}&size=50`, { headers });
            }
            if (!res.ok()) {
                throw new Error(`GET /api/v1/default-commissions (page ${pageNum}) failed: ${res.status()} ${await res.text().catch(() => '')}`);
            }
            const json = await res.json() as { content: DefaultCommissionApiEntry[]; last: boolean };
            all.push(...json.content);
            if (json.last) break;
        }
        return all;
    }

    /** The one entry (if any) matching an exact `transactionTypeCode` + platform — there is only ever one, confirmed live 2026-09-24 via the backend's own 409 COMMISSION_ALREADY_EXISTS on a duplicate create attempt. */
    async apiFindCommission(transactionTypeCode: string, platform: 'WEB' | 'APP' | 'SYSTEM'): Promise<DefaultCommissionApiEntry | null> {
        const all = await this.apiFetchAllCommissions();
        return all.find(e => e.transactionTypeCode === transactionTypeCode && e.platformType.toUpperCase() === platform) ?? null;
    }

    /** Activates or deactivates a commission by id via its own dedicated endpoint — no body, no UI dropdown. */
    async apiSetActive(id: number, active: boolean): Promise<void> {
        const action = active ? 'activate' : 'deactivate';
        let headers = await this.ensureApiHeaders();
        let res = await this.page.request.put(`${API_BASE}/api/v1/default-commissions/${id}/${action}`, { headers });
        if (res.status() === 401) {
            // See `apiFetchAllCommissions`'s identical retry — stale/expired
            // captured headers, not a real auth failure.
            headers = await this.ensureApiHeaders(true);
            res = await this.page.request.put(`${API_BASE}/api/v1/default-commissions/${id}/${action}`, { headers });
        }
        if (!res.ok()) {
            throw new Error(`PUT /api/v1/default-commissions/${id}/${action} failed: ${res.status()} ${await res.text().catch(() => '')}`);
        }
    }


    /** From the admin shell (already logged in), expand Commission Management and open Default Commission. */
    async gotoDefaultCommission(): Promise<void> {
        await this.page.goto(DEFAULT_COMMISSION_URL, { waitUntil: 'domcontentloaded' });
        await this.recoverIfBouncedToLogin();
        await this.waitForListLoaded();
    }

    /**
     * A navigation straight after `login()` can occasionally bounce back to
     * `/admin/auth/login` before the session has actually settled (confirmed
     * live 2026-09-23 — `waitForListLoaded` then times out waiting for
     * `.total-pages`, which never renders on the login page, with no
     * indication of the real cause). Ground-truth check on the URL rather
     * than trusting the navigation landed, and log in again once if it
     * didn't — same self-healing approach as `recoverFromExpiredSession`,
     * just for the "silently bounced to login" variant instead of the
     * "Session Expired" dialog variant.
     */
    private async recoverIfBouncedToLogin(returnTo: string = DEFAULT_COMMISSION_URL): Promise<void> {
        if (!this.page.url().includes('/admin/auth/login')) return;
        await new AdminOtpConfigPage(this.page).login();
        await this.page.goto(returnTo, { waitUntil: 'domcontentloaded' });
    }

    /** Navigates via the sidebar instead of a direct URL — use when a spec wants to assert the nav itself. */
    async openViaSidebar(): Promise<void> {
        await this.commissionManagementNavItem.click();
        await this.defaultCommissionNavLink.click();
        await this.waitForListLoaded();
    }

    /**
     * A suite that does a lot of merchant-side work between admin actions
     * (e.g. a Topup-Commission spec's many `beforeEach` navigations) can
     * easily outlive the admin SPA's own session — a "Session Expired /
     * Please Log In Again" dialog (`app-action-modal#main-info-modal`) then
     * blocks every further click until dismissed and a fresh login is done
     * (confirmed live 2026-09-16, ~14 minutes into a run). Call this before
     * any action that might run long after the initial login; it's a no-op
     * when the session is still alive.
     */
    private async recoverFromExpiredSession(): Promise<void> {
        const expired = this.page.getByText(/Session Expired/i);
        const isExpired = await expired
            .waitFor({ state: 'visible', timeout: 1000 })
            .then(() => true)
            .catch(() => false);
        if (!isExpired) return;

        // Return to whatever page the caller was actually on, not a
        // hardcoded Default Commission — the "Session Expired" dialog is an
        // overlay on top of the current route, so `this.page.url()` here is
        // still that route (confirmed live 2026-09-27: this method is also
        // reached from Accounts Commission call sites — `openAddNewCommission`/
        // `openEditForm`/`activateRow`/`disableRow` are shared by both
        // screens — and unconditionally re-landing on Default Commission
        // stranded an Accounts Commission caller on the wrong screen
        // entirely, silently attempting its next action there instead).
        const returnTo = this.page.url();
        await this.page.getByRole('button', { name: /^Ok$/i }).click();
        await new AdminOtpConfigPage(this.page).login();
        await this.page.goto(returnTo, { waitUntil: 'domcontentloaded' });
    }

    /**
     * The header renders before the row data does (fresh navigations hit the
     * SPA's initial bootstrap render, not just an API round-trip) — waiting on
     * the header alone lets later steps race an empty "No Data Found" list.
     * The paginator's total-count label (`.total-pages`) only renders once the
     * list API response has landed WITH at least one row — confirmed live
     * 2026-09-23: a genuinely empty result (e.g. right after a fresh
     * `createCommission()` call raced a transient backend blip on the very
     * next list fetch) renders "No data found" with no `.total-pages` footer
     * at all, so waiting on that label first — before ever checking for the
     * empty state — burned the full 20s on a label that was never going to
     * appear, even though the page had already told us the answer. Race both
     * conditions from the start instead of sequentially.
     */
    async waitForListLoaded(): Promise<void> {
        await Promise.race([
            this.totalCommissionsLabel.waitFor({ state: 'visible', timeout: 20000 }),
            this.page.getByText(/No Data Found/i).waitFor({ state: 'visible', timeout: 20000 }),
        ]);
        // The total-count label and the row list itself aren't guaranteed to
        // land in the same change-detection tick — waiting on the label alone
        // let callers race an as-yet-empty list (rows.count() === 0) straight
        // into a false "not found". Wait for at least one row, or an explicit
        // empty-state, whichever actually applies.
        await Promise.race([
            this.rows.first().waitFor({ state: 'visible', timeout: 10000 }),
            this.page.getByText(/No Data Found/i).waitFor({ state: 'visible', timeout: 10000 }),
        ]).catch(() => { /* best-effort — callers still re-check row count themselves */ });
    }

    /**
     * The real version of the row-or-empty-state race above — throws instead
     * of swallowing, for callers about to treat `.count()` as authoritative
     * ("this transaction type doesn't exist anywhere in the grid"). Without
     * this, a page that's still rendering reads as 0 matches indistinguishably
     * from a genuinely empty page, and a scan can wrongly report live data as
     * missing (confirmed live: a row-scan method did exactly this for a row
     * that demonstrably existed).
     */
    private async waitForRowsRenderedOrEmpty(): Promise<void> {
        await Promise.race([
            this.rows.first().waitFor({ state: 'visible', timeout: 15000 }),
            this.page.getByText(/No Data Found/i).waitFor({ state: 'visible', timeout: 15000 }),
        ]);
    }

    /**
     * The grid renders rows immediately using raw internal type codes (e.g.
     * "102002") and patches in the friendly transaction-type label (e.g.
     * "Biller Bank Cashin") once a separate lookup call resolves — a literal
     * "Loading..." placeholder has been observed live in that cell mid-race
     * (confirmed live 2026-09-23). `waitForRowsRenderedOrEmpty` only waits
     * for rows to exist, not for their labels to hydrate, so a name-based
     * scan (`rowByTransactionType`) run right after it can miss a row that's
     * genuinely there — the exact kind of miss that then wrongly falls
     * through to an unnecessary (and slow) create-new-commission path. Waits
     * for every currently-rendered row's label to move past the literal
     * "Loading..." placeholder; best-effort (doesn't throw) since a
     * genuinely code-only label (no friendly name configured) would
     * otherwise hang this out to its timeout on every scan.
     */
    private async waitForTransactionTypesResolved(): Promise<void> {
        await this.page.waitForFunction(
            (selector) => Array.from(document.querySelectorAll(selector))
                .every(node => node.textContent?.trim() !== 'Loading...'),
            '#default-commission-row-transaction-type .grid-item-data',
            { timeout: 5000 },
        ).catch(() => { /* best-effort — see comment above */ });
    }

    // ── Row lookup ──────────────────────────────────────────────────────────

    transactionTypeCell(row: Locator): Locator {
        return row.locator('#default-commission-row-transaction-type .grid-item-data');
    }

    statusBadge(row: Locator): Locator {
        return row.locator('.status-badge');
    }

    statusToggleButton(row: Locator): Locator {
        return row.locator('#default-commission-row-status-button');
    }

    editIcon(row: Locator): Locator {
        return row.locator('#user-commissions-row-edit');
    }

    minValueCell(row: Locator): Locator {
        return row.locator('#default-commission-row-min-value .grid-item-data');
    }

    maxValueCell(row: Locator): Locator {
        return row.locator('#default-commission-row-max-value .grid-item-data');
    }

    amountCell(row: Locator): Locator {
        return row.locator('#user-commissions-row-amount .grid-item-data');
    }

    /** True once the row's badge carries `status-active` (vs. `status-inactive` when disabled). */
    async isRowActive(row: Locator): Promise<boolean> {
        const cls = await this.statusBadge(row).getAttribute('class');
        return /\bstatus-active\b/.test(cls ?? '');
    }

    /**
     * A row Locator scoped by its transaction-type text rather than a
     * positional `.nth(i)` index. `activateRow`/`editCommission` etc. trigger
     * a re-render (status change, list refresh) that can reshuffle row order —
     * Angular's `*ngFor` isn't guaranteed to keep the same row at the same
     * index across a refetch — so a positional locator can silently start
     * pointing at a *different* row on the next poll. Content-based filtering
     * re-resolves to the same logical row regardless of position.
     */
    private rowByTransactionType(transactionType: string): Locator {
        const escaped = transactionType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return this.rows.filter({
            has: this.page.locator('#default-commission-row-transaction-type .grid-item-data', {
                hasText: new RegExp(`^\\s*${escaped}\\s*$`),
            }),
        });
    }

    /**
     * Finds the row for an exact transaction-type label (e.g. "Merchant Bank
     * Transfer") by paging through the list — the grid paginates (10/page) and
     * has no reliable transaction-type filter option list confirmed yet, so
     * this scans pages via the Next button rather than relying on the filter
     * panel. Returns the row Locator (left on the page where it was found), or
     * null if it isn't present on any page.
     */
    async findRowByTransactionType(transactionType: string): Promise<Locator | null> {
        for (let guard = 0; guard < 20; guard++) {
            await this.waitForRowsRenderedOrEmpty();
            await this.waitForTransactionTypesResolved();
            const row = this.rowByTransactionType(transactionType);
            if (await row.count() > 0) return row.first();

            const nextDisabled = await this.nextPageButton
                .locator('xpath=..')
                .getAttribute('class')
                .then(cls => (cls ?? '').includes('disabled'))
                .catch(() => true);
            if (nextDisabled) return null;

            await this.nextPageButton.click();
            await this.waitForListLoaded();
        }
        return null;
    }

    /**
     * Same page-scan as `findRowByTransactionType`, but for a transaction type
     * that may have more than one row — returns the first one whose Platform
     * matches. Platform is only ever exposed reliably via the edit form (see
     * `readCurrentValues`, which normalizes it to uppercase); there is no
     * confirmed grid-cell id for it, so this opens/cancels the edit form for
     * each same-named row in turn rather than guessing a column locator.
     * Returns the matching row together with its already-read values, or null
     * if no page has a match.
     */
    async findRowByTransactionTypeAndPlatform(
        transactionType: string,
        platform: 'WEB' | 'APP' | 'SYSTEM',
    ): Promise<{ row: Locator; values: CommissionFormValues } | null> {
        // The admin grid has been observed live (2026-09-24) to reset itself
        // back to page 1 on its own mid-scan — presumably an idle/poll
        // auto-refresh — which strands an already-matched row on a page
        // that's no longer showing (readCurrentValues/openEditForm then
        // throws the `STALE_ROW` marker). Re-navigating and restarting the
        // whole scan from page 1 is the only real recovery: the row's
        // content is still valid, just not currently visible, and a fresh
        // scan finds it again wherever it now lands. Bounded to 2 top-level
        // attempts so a *genuinely* broken page still fails instead of
        // looping forever.
        for (let topAttempt = 1; topAttempt <= 2; topAttempt++) {
            try {
                return await this.scanForRowByTransactionTypeAndPlatform(transactionType, platform);
            } catch (e) {
                if (topAttempt === 2 || !(e instanceof Error) || !e.message.startsWith('STALE_ROW')) throw e;
                await this.gotoDefaultCommission();
            }
        }
        return null; // unreachable — satisfies the type checker
    }

    private async scanForRowByTransactionTypeAndPlatform(
        transactionType: string,
        platform: 'WEB' | 'APP' | 'SYSTEM',
    ): Promise<{ row: Locator; values: CommissionFormValues } | null> {
        // The grid has been observed live to re-show the same pinned row
        // across "pages" (confirmed live 2026-09-23: identical rows 0-3 on
        // both page 1 and page 2 of a 17-row, 2-page list) — skip a row
        // whose min/max we've already read this scan rather than paying for
        // another open-edit-form/read/Cancel round-trip on it. That
        // redundant cost is exactly what was starving this method's callers
        // of their 90s `beforeAll` budget before ever reaching a genuine
        // platform match.
        const seen = new Set<string>();
        for (let guard = 0; guard < 20; guard++) {
            await this.waitForRowsRenderedOrEmpty();
            await this.waitForTransactionTypesResolved();
            const candidates = this.rowByTransactionType(transactionType);
            const count = await candidates.count();
            for (let i = 0; i < count; i++) {
                const row = candidates.nth(i);
                const key = `${await this.minValueCell(row).innerText().catch(() => '')}|${await this.maxValueCell(row).innerText().catch(() => '')}`;
                if (seen.has(key)) continue;
                seen.add(key);

                const values = await this.readCurrentValues(row);
                if (values.platform === platform) return { row, values };
            }

            const nextDisabled = await this.nextPageButton
                .locator('xpath=..')
                .getAttribute('class')
                .then(cls => (cls ?? '').includes('disabled'))
                .catch(() => true);
            if (nextDisabled) return null;

            await this.nextPageButton.click();
            await this.waitForListLoaded();
        }
        return null;
    }

    /**
     * Same page-scan as `findRowByTransactionType`, but for re-locating one
     * specific row among same-named duplicates by its previously-read values
     * (platform + amount range + value + percentage flag) rather than by
     * position — used to restore the exact row `prepareTopupCommission`/
     * `ensureAppScopedTopupCommission` found or created earlier, without
     * accidentally matching a different duplicate. Returns the matching row,
     * or null if no page has one.
     */
    async findRowByTransactionTypeAndValues(
        transactionType: string,
        values: CommissionFormValues,
    ): Promise<Locator | null> {
        // See `findRowByTransactionTypeAndPlatform`'s header comment — same
        // recovery for the same live-observed grid auto-reset.
        for (let topAttempt = 1; topAttempt <= 2; topAttempt++) {
            try {
                return await this.scanForRowByTransactionTypeAndValues(transactionType, values);
            } catch (e) {
                if (topAttempt === 2 || !(e instanceof Error) || !e.message.startsWith('STALE_ROW')) throw e;
                await this.gotoDefaultCommission();
            }
        }
        return null; // unreachable — satisfies the type checker
    }

    private async scanForRowByTransactionTypeAndValues(
        transactionType: string,
        values: CommissionFormValues,
    ): Promise<Locator | null> {
        for (let guard = 0; guard < 20; guard++) {
            await this.waitForRowsRenderedOrEmpty();
            await this.waitForTransactionTypesResolved();
            const candidates = this.rowByTransactionType(transactionType);
            const count = await candidates.count();
            for (let i = 0; i < count; i++) {
                const row = candidates.nth(i);
                const candidateValues = await this.readCurrentValues(row);
                if (
                    candidateValues.platform === values.platform
                    && candidateValues.minimumAmount === values.minimumAmount
                    && candidateValues.maximumAmount === values.maximumAmount
                    && candidateValues.value === values.value
                    && candidateValues.isPercentage === values.isPercentage
                ) return row;
            }

            const nextDisabled = await this.nextPageButton
                .locator('xpath=..')
                .getAttribute('class')
                .then(cls => (cls ?? '').includes('disabled'))
                .catch(() => true);
            if (nextDisabled) return null;

            await this.nextPageButton.click();
            await this.waitForListLoaded();
        }
        return null;
    }

    // ── Filter panel ─────────────────────────────────────────────────────────

    transactionTypeFilterInput(): Locator {
        return this.page.locator('#input_type_dropdown_name_transactionTypeCode_TransactionType');
    }

    private transactionTypeFilterSearchInput(): Locator {
        return this.page.locator('#ddl_search_input_type_dropdown_name_transactionTypeCode_TransactionType');
    }

    platformFilterInput(): Locator {
        return this.page.locator('#input_type_dropdown_name_platformType_Platform');
    }

    private platformFilterSearchInput(): Locator {
        return this.page.locator('#ddl_search_input_type_dropdown_name_platformType_Platform');
    }

    statusFilterInput(): Locator {
        return this.page.locator('#input_type_dropdown_name_isActive_Status');
    }

    private async ensureFilterPanelOpen(): Promise<void> {
        const isOpen = await this.transactionTypeFilterInput().isVisible().catch(() => false);
        if (isOpen) return;
        await this.filterToggle.click();
        await this.transactionTypeFilterInput().waitFor({ state: 'visible', timeout: 5000 });
    }

    /**
     * Selects `optionText` from one of the filter panel's ng-bootstrap search
     * dropdowns (Transaction Type / Platform) — same "click, verify, retry"
     * caution as every other custom dropdown in this file, since these share
     * the same component and have shown the identical "click reported
     * delivered but didn't stick" failure mode elsewhere (`chooseAccountType`,
     * `choosePlatform`). Confirmed live 2026-09-24: a one-shot, unverified
     * attempt at this left the grid showing all rows, unfiltered, with no
     * error raised — silently doing nothing is this component's default
     * failure mode, not a thrown exception, so verifying the dropdown's own
     * displayed value afterward is the only way to know it actually landed.
     */
    private async selectFilterDropdownOption(dropdownInput: Locator, searchInput: Locator, optionText: string): Promise<void> {
        // Re-selecting an already-selected value is a no-op click that
        // leaves the panel open instead of closing it — the exact same
        // ngbDropdown quirk `choosePlatform` already documents and guards
        // against for the Add/Edit modal's own Platform field (confirmed
        // live 2026-09-25 for this filter dropdown too: `gotoDefaultCommission`
        // navigates to the *same* Angular route it's already on, so the SPA
        // doesn't reset this reactive-forms value between calls, and a
        // second "select Biller Bank Cashin" here found the option list
        // never reopened, leaving the field blank after 3 retries).
        const current = (await dropdownInput.inputValue().catch(() => '')).trim();
        if (current.toLowerCase() === optionText.toLowerCase()) return;

        let selected = false;
        for (let attempt = 1; attempt <= 3 && !selected; attempt++) {
            await dropdownInput.click();
            await searchInput.fill(optionText).catch(() => { /* search box may not be focusable instantly */ });
            const option = this.page.locator('li:visible').filter({ hasText: new RegExp(`^\\s*${optionText}\\s*$`, 'i') }).first();
            const opened = await option.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
            if (opened) {
                await option.click();
                await this.page.keyboard.press('Escape');
            }
            selected = await dropdownInput.inputValue().then(v => v.trim().toLowerCase() === optionText.toLowerCase()).catch(() => false);
        }
        await expect(
            dropdownInput,
            `filter dropdown shows "${optionText}" (retried up to 3x)`,
        ).toHaveValue(new RegExp(`^\\s*${optionText}\\s*$`, 'i'), { timeout: 5000 });
    }

    /**
     * Filters the Default Commission grid by exact Transaction Type +
     * Platform via the filter panel's own dropdowns, rather than scanning
     * pages by the grid's displayed label. The grid has been confirmed live
     * (2026-09-24) to sometimes render a row's transaction type as a raw
     * internal code instead of its friendly name — a text-scan can never
     * match that row no matter how long it waits, but the filter dropdown's
     * options come from the same lookup the friendly names do, so filtering
     * finds the row regardless of what its grid cell happens to display.
     */
    async filterByTransactionTypeAndPlatform(transactionType: string, platform: 'WEB' | 'APP' | 'SYSTEM'): Promise<void> {
        await this.ensureFilterPanelOpen();
        await this.selectFilterDropdownOption(this.transactionTypeFilterInput(), this.transactionTypeFilterSearchInput(), transactionType);
        await this.selectFilterDropdownOption(this.platformFilterInput(), this.platformFilterSearchInput(), platform);
        await this.searchButton.click();
        await this.waitForListLoaded();
    }

    async clearFilter(): Promise<void> {
        await this.clearFilterButton.click();
        await this.waitForListLoaded();
    }

    /**
     * Finds the (at most one) row for an exact transaction type + platform
     * using the filter panel instead of scanning pages — see
     * `filterByTransactionTypeAndPlatform`'s header comment for why this is
     * the reliable option. Returns the row and its current values (still
     * read via the edit form — the filter tells us *which* row, not its
     * amount/value fields), or null if the filtered result is empty.
     */
    async findRowByFilter(
        transactionType: string,
        platform: 'WEB' | 'APP' | 'SYSTEM',
    ): Promise<{ row: Locator; values: CommissionFormValues } | null> {
        await this.filterByTransactionTypeAndPlatform(transactionType, platform);
        // A single-shot, non-waiting `.isVisible()` check for "No Data Found"
        // here (as this used to do) is the same false-positive class of race
        // already fixed for row staleness elsewhere in this file: run right
        // after Search, it can catch the filtered results mid-render and
        // wrongly conclude "empty" before the row has had a chance to
        // appear (confirmed live 2026-09-25 — a row this same filter found
        // reliably in isolation seconds earlier read as empty here, sending
        // a caller down the create-a-duplicate path instead, which the
        // backend then rejected with 409 COMMISSION_ALREADY_EXISTS).
        // `waitForRowsRenderedOrEmpty` properly waits for either condition
        // instead of snapshotting one of them.
        await this.waitForRowsRenderedOrEmpty();
        if (await this.rows.count() === 0) return null;
        const row = this.rows.first();
        const values = await this.readCurrentValues(row);
        return { row, values };
    }

    // ── Status toggle ───────────────────────────────────────────────────────

    /**
     * Activates a disabled row via its status dropdown. No-ops if already
     * active. The menu offers exactly one alternative item at a time — labeled
     * "Activate" (id suffix `-item-true`) when currently disabled, "Disable"
     * (`-item-false`) when currently active — so this always targets the
     * `-item-true` entry.
     *
     * The dropdown (`ngbDropdown` with `container="body"`) portals its menu
     * to the end of `<body>` once opened, detaching it from the row's DOM
     * subtree — a row-scoped locator for the menu item would miss it. Since
     * only one such menu is open at a time, look it up page-wide filtered to
     * the currently-visible instance instead.
     *
     * Choosing "Activate" from the menu does NOT commit the change by itself —
     * it opens an "Activate Commission" confirmation dialog ("Turning On The
     * Button Will Make The Commission Active...") with its own Activate
     * button that has to be clicked too (confirmed live 2026-09-16).
     */
    async activateRow(row: Locator): Promise<void> {
        await this.recoverFromExpiredSession();
        if (await this.isRowActive(row)) return;
        await this.statusToggleButton(row).click();
        const activateItem = this.page.locator('#default-commission-row-status-item-true:visible').first();
        await activateItem.waitFor({ state: 'visible', timeout: 5000 });
        await activateItem.click();
        const confirmActivate = this.page.getByRole('button', { name: /^Activate$/i });
        await confirmActivate.waitFor({ state: 'visible', timeout: 5000 });
        await confirmActivate.click();
        await expect(this.statusBadge(row), 'row status flips to Active after confirming Activate').toHaveClass(/status-active/, { timeout: 10000 });
    }

    /**
     * Disables an active row via its status dropdown. No-ops if already
     * disabled. Mirrors `activateRow()` — assumed (not yet confirmed live) to
     * open an analogous "Disable Commission" confirmation dialog with its own
     * Disable button, by symmetry with the Activate flow.
     */
    async disableRow(row: Locator): Promise<void> {
        await this.recoverFromExpiredSession();
        if (!(await this.isRowActive(row))) return;
        await this.statusToggleButton(row).click();
        const disableItem = this.page.locator('#default-commission-row-status-item-false:visible').first();
        await disableItem.waitFor({ state: 'visible', timeout: 5000 });
        await disableItem.click();
        const confirmDisable = this.page.getByRole('button', { name: /^Disable$/i });
        await confirmDisable.waitFor({ state: 'visible', timeout: 5000 });
        await confirmDisable.click();
        await expect(this.statusBadge(row), 'row status flips to Disable after confirming Disable').toHaveClass(/status-inactive/, { timeout: 10000 });
    }

    // ── Add New Commission (2-step wizard) ─────────────────────────────────

    async openAddNewCommission(): Promise<void> {
        await this.recoverFromExpiredSession();
        await this.addNewCommissionButton.click();
        await this.modalOverlay.waitFor({ state: 'visible', timeout: 15000 });
    }

    /**
     * Step 1 of Add New Commission: pick the broad category (Bank Transfer,
     * Cash-In, ...). Each category row is a readonly input whose `placeholder`
     * IS the category label, so this doesn't depend on guessing an id casing
     * convention. `{ force: true }` is required — the modal's own content
     * briefly reports itself as "intercepting pointer events" on first paint,
     * and a plain click retries against that until it times out.
     */
    async chooseCommissionCategory(category: string): Promise<void> {
        const categoryInput = this.chooseTypeModal.locator(`input[placeholder="${category}"]`);
        await categoryInput.click({ force: true });
    }

    /**
     * Step 2: within the "<Category> Commission" form, opens the "Choose
     * <Category> Transaction" checkbox dropdown and picks the entry for
     * `accountType` (e.g. `ACCOUNT_TYPE.MERCHANT` matches "Merchant Bank
     * Transfer", "Merchant Cashin", ...) — this is where the account-type
     * distinction actually lives, not a separate field. Matched by prefix
     * rather than an exact label since the checkbox wording per category
     * isn't guaranteed to match the grid's column text verbatim, and isn't
     * even a fixed set of 4 per category — confirmed live: Bank Transfer
     * offers Customer/Merchant/Biller/Company, Cash-In only offers
     * Customer/Merchant/Biller (no Company Cashin).
     *
     * This is a checkbox-style dropdown (ng-bootstrap keeps it open on inside
     * clicks so multiple boxes could be checked) — it does not close itself
     * after picking one item, and its expanded panel then overlaps and
     * intercepts clicks on the Platform field below it. Close it explicitly
     * with Escape before returning.
     *
     * Each option row carries its own checkbox — the selection is made by
     * clicking that checkbox specifically, not the row/label text (confirmed
     * live: clicking the row was reported as a successful click by Playwright
     * without ever toggling the control, leaving the "Choose ... Transaction"
     * field empty and Confirm disabled). The option list may also portal
     * outside `#modal_default` (same as `choosePlatform`'s), so this searches
     * page-wide rather than scoping to the modal — but scoped to `ul.banks`
     * specifically, not every `<li>` on the page: a bare `li:visible` search
     * is wide enough to match an unrelated list still present behind the
     * modal (confirmed live: it picked "Wallet To Wallet Transfer" — a
     * step-1 category option, not a step-2 transaction type — instead of
     * "Merchant Cashin"). Verifies the field actually shows a selection
     * afterwards, retrying otherwise, rather than trusting the click alone.
     */
    async chooseAccountType(accountType: string): Promise<void> {
        const dropdownInput = this.modalOverlay.locator('input[id^="input_type_text_name_standalone_Choose"]');

        let selected = false;
        for (let attempt = 1; attempt <= 3 && !selected; attempt++) {
            await dropdownInput.click();
            const item = this.page.locator('ul.banks li:visible').filter({ hasText: new RegExp(`^\\s*${accountType}\\b`, 'i') }).first();
            // Observed occasionally slow to render under load — same class of
            // timing issue as choosePlatform's dropdown.
            const opened = await item.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
            if (opened) {
                const checkbox = item.locator('input[type="checkbox"]');
                if (await checkbox.count() > 0) {
                    await checkbox.first().click();
                } else {
                    await item.click();
                }
                await this.page.keyboard.press('Escape');
                await item.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { /* already closed */ });
            }
            selected = await dropdownInput.inputValue().then(v => v.trim().length > 0).catch(() => false);
        }
        await expect(
            dropdownInput,
            `"Choose ... Transaction" field shows a selection after picking "${accountType}" (retried up to 3x)`,
        ).not.toHaveValue('', { timeout: 5000 });
    }

    platformDropdownInput(): Locator {
        return this.modalOverlay.locator('input[id$="_Platform"]');
    }

    /**
     * Re-selecting the already-active platform hangs every field after it:
     * this dropdown only auto-closes on an actual value-change event, so
     * clicking an option that's already selected leaves the panel open,
     * overlapping and intercepting clicks/fills on the Minimum Amount field
     * below it until the test times out (confirmed live 2026-09-16). Skip
     * the no-op click entirely, and defensively force-close for genuine
     * changes too rather than assume the framework always closes cleanly.
     *
     * The option list itself portals to the end of <body> once opened (same
     * `ngbDropdown container="body"` pattern as the row status dropdown in
     * `activateRow`/`disableRow`) — detached from `#modal_default`'s DOM
     * subtree, so it has to be looked up page-wide rather than scoped to the
     * modal (confirmed live in the Add-New-Commission wizard: the click
     * landed fine, the option just wasn't a descendant of the modal).
     * Filtered to the visible instance since only one such dropdown is open
     * at a time. The click is still retried a few times as a defensive
     * measure — same pattern as `openEditForm`/`BankTransferHelper.ts`'s
     * `proceedToConfirmation` — in case the option list is genuinely slow to
     * render rather than mis-scoped.
     */
    async choosePlatform(platform: 'WEB' | 'APP' | 'SYSTEM'): Promise<void> {
        const current = (await this.platformDropdownInput().inputValue()).trim();
        if (current === platform) return;

        const item = this.page.locator('li:visible').filter({ hasText: new RegExp(`^\\s*${platform}\\s*$`) }).first();

        let opened = false;
        for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
            await this.platformDropdownInput().click();
            // The option list renders behind its own loading spinner (see the
            // dump's `.dropdown-menu.loader` / `loading-container-*` markup) —
            // 5s was observed too tight under load; give it real room.
            opened = await item.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        }
        await expect(item, `platform dropdown shows a "${platform}" option (retried up to 3x)`).toBeVisible();

        await item.click();
        await this.page.keyboard.press('Escape');
        await item.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { /* already closed */ });
    }

    /**
     * Matched by id suffix, not the exact Default Commission id — the
     * Accounts Commission modal's own Min/Max fields carry `minValue`/
     * `maxValue` in the middle of the id instead of Default's `min`/`max`
     * (confirmed live 2026-09-27: `input_type_text_name_minValue_MinimumAmount`
     * vs Default's `input_type_text_name_min_MinimumAmount`), even though
     * both screens share this exact modal component otherwise. Suffix
     * matching lets one `fillCommissionValues` serve both without a
     * per-screen branch.
     */
    minimumAmountInput(): Locator {
        return this.modalOverlay.locator('input[id$="_MinimumAmount"]');
    }

    maximumAmountInput(): Locator {
        return this.modalOverlay.locator('input[id$="_MaximumAmount"]');
    }

    valueInput(): Locator {
        return this.modalOverlay.locator('#input_type_text_name_amountValue_value');
    }

    percentageToggle(): Locator {
        return this.modalOverlay.locator('.percentage-toggle input[type="checkbox"]');
    }

    confirmButton(): Locator {
        return this.modalOverlay.getByRole('button', { name: /^confirm$/i });
    }

    cancelButton(): Locator {
        return this.modalOverlay.getByRole('button', { name: /^Cancel$/i });
    }

    /**
     * Fills the amount/platform fields shared by both the Add and Edit forms.
     * Does not submit — call `confirmButton()` (Add) once the wizard's
     * "Choose ... Transaction" step has also been completed, or immediately
     * after `openEditForm()` (Edit doesn't have that step).
     *
     * Every step below passes an explicit `timeout` — unlike `choosePlatform`,
     * `openEditForm`, `activateRow` etc. (which all learned this the hard way,
     * see their own comments), this method previously left every action at
     * Playwright's default, which doesn't fail fast: it just keeps retrying
     * until the *test's* own timeout budget runs out. A stuck step then
     * surfaces as an opaque "Test timeout of 150000ms exceeded" with no
     * indication of which locator stalled, instead of a specific, fast
     * `TimeoutError` (confirmed live: Min/Max Amount filled, Platform
     * correctly set, but execution stalled around the percentage
     * toggle/value step for the rest of the test's budget).
     */
    async fillCommissionValues(values: CommissionFormValues): Promise<void> {
        if (values.platform) await this.choosePlatform(values.platform);
        await this.minimumAmountInput().fill(values.minimumAmount, { timeout: 10000 });
        await this.maximumAmountInput().fill(values.maximumAmount, { timeout: 10000 });

        const wantsPercentage = values.isPercentage ?? true;
        // The native checkbox sits off-canvas (not just CSS-hidden) behind a
        // custom-styled toggle switch. Three approaches tried, each failing
        // differently: clicking the input directly (even `force: true`)
        // throws "Element is outside of the viewport" (2026-09-23), since
        // Playwright still needs a resolvable page coordinate; clicking the
        // visible wrapper (`.percentage-toggle`) lands fine but never flips
        // the input's `checked` state at all (2026-09-23+1); dispatching a
        // bare `click` event flips the DOM `checked` property (satisfying a
        // read of it) but does NOT reliably propagate to whatever Angular
        // binding actually determines the submitted commission `type` —
        // confirmed live 2026-09-27 via the API: editing a live commission
        // to `isPercentage: false` reported success and the toggle read back
        // correctly unchecked, yet the backend still stored
        // `type: "PERCENTAGE"`, applying "500" as 500% instead of a fixed
        // 500 (TU-CM03's own failure). A native checkbox's activation
        // behavior normally fires `click` and then `input`/`change` in
        // sequence — dispatching only `click` skips the pair Angular's
        // reactive-forms binding most likely listens on. Setting `checked`
        // directly and firing both explicitly, bubbling, covers whichever
        // one the binding actually uses.
        await this.percentageToggle().waitFor({ state: 'attached', timeout: 10000 });
        // Retry and verify rather than trusting one dispatch — same
        // "reported success but didn't stick" caution as every other control
        // in this file.
        let isChecked = await this.percentageToggle().isChecked({ timeout: 10000 });
        for (let attempt = 1; attempt <= 3 && isChecked !== wantsPercentage; attempt++) {
            await this.percentageToggle().evaluate((el: HTMLInputElement, checked: boolean) => {
                el.checked = checked;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, wantsPercentage);
            isChecked = await this.percentageToggle().isChecked({ timeout: 10000 });
        }
        await expect(
            this.percentageToggle(),
            `percentage toggle reflects isPercentage=${wantsPercentage} (retried up to 3x)`,
        ).toBeChecked({ checked: wantsPercentage, timeout: 5000 });

        // Same "reported success but didn't stick" class of issue as the
        // toggle above (and chooseAccountType/choosePlatform) — retry the
        // fill and verify it actually landed rather than trusting one call.
        let filled = false;
        for (let attempt = 1; attempt <= 3 && !filled; attempt++) {
            await this.valueInput().fill(values.value, { timeout: 10000 });
            filled = await this.valueInput().inputValue().then(v => v === values.value).catch(() => false);
        }
        await expect(this.valueInput(), 'value field holds the filled amount (retried up to 3x)').toHaveValue(values.value, { timeout: 5000 });
    }

    /**
     * Clicks Confirm and waits for the modal to close. A single click here
     * has been observed to land (Playwright reports it delivered) without
     * the app actually submitting the form — the same "reported success but
     * didn't stick" class of issue documented throughout this file for the
     * percentage toggle, chooseAccountType, choosePlatform, and
     * openEditForm's edit icon (confirmed live 2026-09-23: TU-CM32 timed out
     * waiting for `#modal_default` to hide after a single Confirm click).
     * Retry the click itself rather than only waiting longer on one attempt.
     */
    private async confirmAndWaitClosed(): Promise<void> {
        let closed = false;
        // Captures the actual create/update API response for each attempt —
        // the definitive answer to "did the backend reject this and why,"
        // rather than inferring it from UI-side toast/error selectors that
        // have already proven unreliable here (a prior attempt found a
        // matching toast element with empty text, no clearer than nothing).
        let lastResponse: { status: number; url: string; body: string } | null = null;
        for (let attempt = 1; attempt <= 3 && !closed; attempt++) {
            const responsePromise = this.page
                .waitForResponse(
                    r => /commission/i.test(r.url()) && ['POST', 'PUT'].includes(r.request().method()),
                    { timeout: 5000 },
                )
                .catch(() => null);
            await this.confirmButton().click();
            const response = await responsePromise;
            if (response) {
                lastResponse = {
                    status: response.status(),
                    url: response.url(),
                    body: await response.text().catch(() => '<unreadable>'),
                };
            }
            closed = await this.modalOverlay
                .waitFor({ state: 'hidden', timeout: 5000 })
                .then(() => true)
                .catch(() => false);
        }
        if (!closed) {
            // A retried-but-still-open modal after Confirm could be: a
            // disabled Confirm button (clicks are no-ops), an inline
            // validation message inside the modal itself (not a page-level
            // toast), or a genuine toast — check all three, plus the actual
            // API response above, so a failure here is self-diagnosing
            // instead of a bare "still visible" timeout.
            const confirmDisabled = await this.confirmButton().isDisabled().catch(() => null);
            const inlineError = await this.modalOverlay
                .locator('[class*="error"], [class*="invalid"], .text-danger')
                .first()
                .innerText({ timeout: 2000 })
                .catch(() => null);
            const toastText = await this.page
                .locator('[class*="toast"], [class*="snack"], mat-snack-bar-container')
                .first()
                .innerText({ timeout: 2000 })
                .catch(() => null);
            const suffix = ` — confirmDisabled=${confirmDisabled}, inlineError=${JSON.stringify(inlineError)}, toast=${JSON.stringify(toastText)}, lastResponse=${JSON.stringify(lastResponse)}`;
            await expect(this.modalOverlay, `commission modal closes after clicking Confirm (retried up to 3x)${suffix}`).toBeHidden({ timeout: 5000 });
        }
    }

    /**
     * Creates a new default commission end-to-end: category → account type
     * (e.g. `ACCOUNT_TYPE.MERCHANT`) → values → Confirm.
     */
    async createCommission(category: string, accountType: string, values: CommissionFormValues): Promise<void> {
        await this.openAddNewCommission();
        await this.chooseCommissionCategory(category);
        await this.chooseAccountType(accountType);
        await this.fillCommissionValues(values);
        await this.confirmAndWaitClosed();
    }

    // ── Edit existing commission ────────────────────────────────────────────

    /**
     * Opens the edit-pencil form for an existing row. Pre-filled; no
     * category/transaction-type step.
     *
     * A single click here has been observed to land (Playwright reports it
     * delivered — element visible/stable) without the app opening the modal,
     * late into a long-running suite (~14 min in, likely a stale Angular
     * event binding rather than a missed click). Retry the click itself
     * rather than just waiting longer on one attempt — same pattern as
     * `BankTransferHelper.ts`'s `proceedToConfirmation`.
     */
    async openEditForm(row: Locator): Promise<void> {
        await this.recoverFromExpiredSession();
        let opened = false;
        for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
            // The admin grid has been observed live (2026-09-24, via trace
            // inspection) to reset itself back to page 1 on its own —
            // presumably an idle/poll auto-refresh — mid-retry, well after a
            // row was matched on a later page. Once that happens, retrying
            // the click is pointless: `row` (content-filtered, but still
            // re-evaluated live against whatever page is now showing) will
            // never resolve again. Detect that distinctly and fail fast with
            // a recognizable marker so callers (`findRowByTransactionType*`)
            // can re-navigate and re-search from scratch instead of a caller
            // seeing the same generic "modal never opened" error a stuck
            // click would also produce.
            //
            // A bare, single-shot `.isVisible()` is the wrong check here —
            // confirmed live 2026-09-24: it fired as a false positive on the
            // very first attempt of both the original scan AND a full fresh
            // re-scan, too fast to be a real page reset. Angular's own
            // change-detection can briefly detach and reattach a bound node
            // within one render tick; a raw snapshot catches that flicker,
            // an auto-retrying `waitFor` rides it out the way every other
            // actionability check in this file already does.
            const stillThere = await row.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
            if (!stillThere) {
                throw new Error('STALE_ROW: row is no longer visible — the grid likely reset to page 1 on its own mid-retry');
            }
            // The click itself needs its own timeout and its own catch — a
            // stuck actionability check here previously ran at Playwright's
            // default (no per-action timeout) and silently ate an entire
            // beforeAll hook's budget (confirmed live 2026-09-24 via trace
            // inspection: a single click accounted for 113s of a 120s hook).
            // A bare `{ timeout: 5000 }` without the catch just moves the
            // problem instead of fixing it: a timed-out click throws and
            // escapes this loop after attempt 1, exactly like an uncaught
            // throw would — so this must swallow that failure the same way
            // the modal-visible wait below already does, to actually retry.
            await this.editIcon(row).click({ timeout: 5000 }).catch(() => { /* retried below */ });
            opened = await this.modalOverlay
                .waitFor({ state: 'visible', timeout: 5000 })
                .then(() => true)
                .catch(() => false);
        }
        await expect(this.modalOverlay, 'edit-commission modal opens after clicking the edit-pencil icon (retried up to 3x)').toBeVisible();
        // The modal overlay itself renders before Angular has patched the
        // reactive form with the row's actual values — on a freshly opened
        // page (a brand-new admin login/session per call, not a long-lived
        // one reused across an entire suite) this race is wide enough to
        // matter: reading platformDropdownInput() immediately after the modal
        // becomes visible can catch it still empty, which makes
        // choosePlatform()'s "already selected" check see "" and try to
        // reselect a platform whose listitem isn't in the DOM yet either
        // (populated by the same fetch), timing out the dropdown search.
        // Confirmed live 2026-09-16.
        await expect(this.platformDropdownInput(), 'edit form\'s Platform field populates from the row data after the modal opens').not.toHaveValue('', { timeout: 10000 });
    }

    /** Opens the edit form for `row`, applies `values`, and confirms. */
    async editCommission(row: Locator, values: CommissionFormValues): Promise<void> {
        await this.openEditForm(row);
        await this.fillCommissionValues(values);
        await this.confirmAndWaitClosed();
    }

    /**
     * Opens the edit form for `row`, reads back its current field values, and
     * closes via Cancel without changing anything — use this to snapshot a
     * row's values before a test mutates them, so they can be restored with
     * `editCommission(row, snapshot)` afterwards.
     */
    async readCurrentValues(row: Locator): Promise<CommissionFormValues> {
        await this.openEditForm(row);
        // The dropdown mirrors the grid's own casing (observed lowercase,
        // e.g. "web") while `choosePlatform`/callers work in uppercase
        // ('WEB' | 'APP' | 'SYSTEM') — normalize here so every consumer of
        // this value (including exact-match lookups) compares reliably.
        const platform = ((await this.platformDropdownInput().inputValue()).trim().toUpperCase() || 'WEB') as CommissionFormValues['platform'];
        const minimumAmount = await this.minimumAmountInput().inputValue();
        const maximumAmount = await this.maximumAmountInput().inputValue();
        const isPercentage = await this.percentageToggle().isChecked();
        const value = await this.valueInput().inputValue();
        await this.cancelButton().click();
        await this.modalOverlay.waitFor({ state: 'hidden', timeout: 10000 });
        return { platform, minimumAmount, maximumAmount, value, isPercentage };
    }

    // ── Accounts Commission (per-account custom overrides) ─────────────────

    /**
     * Opens a single account's Accounts Commission list via the filter form
     * — confirmed live via a direct network capture that the form DOES
     * correctly call `GET .../emi-profile/api/v1/profiles/business/pag?
     * ...&companyNumber=<companyNumber>&mobileNumber=<mobileNumber>` and the
     * backend genuinely narrows to exactly one matching profile ("Total
     * Users: 1"). Every earlier theory that the filter itself was broken
     * (unfiltered fallback, cold-goto race, dropdown-not-a-link) was wrong —
     * the real bug was simply that nothing waited for that specific network
     * response before reading the DOM, so a check could race ahead and read
     * stale (pre-filter) content. `waitForResponse` below closes that gap
     * directly instead of inferring "did it filter" from a DOM side-effect.
     *
     * Confirmed live 2026-09-30, also via network capture: clicking "View
     * Account Commissions" (despite being styled/wired as an `ngbDropdown`
     * toggle) navigates directly to `/admin/main/commission/account-
     * commission` — no intermediate menu item to select.
     *
     * `companyNumber` disambiguates when one mobile number is shared across
     * more than one business account (confirmed live: Topup's own
     * LOGIN_MOBILE resolves to both T2605 and Q9557) — passed straight
     * through as its own query param to the same endpoint above, which is
     * what actually does the narrowing; the `matchCount !== 1` check below
     * is just a safety net in case the backend's own matching behavior
     * changes.
     */
    async openAccountCommissionsByMobile(mobileNumber: string, companyNumber?: string): Promise<void> {
        // `networkidle`, not `domcontentloaded` — confirmed live this
        // matters here: with `domcontentloaded`, the SPA's own initial
        // unfiltered `profiles/business/pag` call can still be in flight
        // when the filter form is interacted with, and Search then returns
        // that same in-flight unfiltered page-1 response (10 rows, the
        // default page size) rather than a freshly filtered one — the
        // working diagnostic that confirmed this endpoint filters correctly
        // used `networkidle` before touching the filter form at all.
        await this.page.goto(ACCOUNTS_LIST_URL, { waitUntil: 'networkidle' });
        await this.recoverIfBouncedToLogin(ACCOUNTS_LIST_URL);

        await this.filterToggle.click();
        const mobileInput = this.page.locator('#input_type_text_name_mobileNumber_mobilenumber');
        await mobileInput.waitFor({ state: 'visible', timeout: 10000 });
        await mobileInput.fill(mobileNumber);
        if (companyNumber) {
            await this.page.locator('#input_type_text_name_companyNumber_companynumber').fill(companyNumber);
        }

        // Matches on the `mobileNumber=` query param specifically, not just
        // the endpoint path — the SPA's own unfiltered initial load hits the
        // exact same path with no filter params, so a looser match here
        // risks resolving against that call instead of the filtered one.
        const searchResponse = this.page.waitForResponse(
            r => r.url().includes('profiles/business/pag') && r.url().includes('mobileNumber='),
            { timeout: 15000 },
        );
        await this.page.getByRole('button', { name: /^Search$/i }).click();
        await searchResponse;

        const viewButtons = this.page.getByRole('button', { name: /View Account Commissions/i });
        const identityText = companyNumber ?? mobileNumber;
        await expect(
            viewButtons.first(),
            `Accounts List shows a "View Account Commissions" row for ${identityText} after filtering`,
        ).toBeVisible({ timeout: 10000 });

        const matchCount = await viewButtons.count();
        if (companyNumber && matchCount !== 1) {
            throw new Error(
                `Accounts List shows ${matchCount} rows after filtering by companyNumber=${companyNumber}, ` +
                `mobileNumber=${mobileNumber} — expected exactly 1, so the "View Account Commissions" link ` +
                'can\'t be followed unambiguously.',
            );
        }

        await viewButtons.first().click();
        await this.page.waitForURL(/\/admin\/main\/commission\/account-commission/, { timeout: 15000 });
        await Promise.race([
            this.accountCommissionRows.first().waitFor({ state: 'visible', timeout: 15000 }),
            this.page.getByText(/No Data Found/i).waitFor({ state: 'visible', timeout: 15000 }),
        ]).catch(() => { /* best-effort — callers re-check row count themselves */ });
    }

    accountTransactionTypeCell(row: Locator): Locator {
        return row.locator('#user-commissions-row-transaction-type .grid-item-data');
    }

    accountMinValueCell(row: Locator): Locator {
        return row.locator('#user-commissions-row-min-amount .grid-item-data');
    }

    accountMaxValueCell(row: Locator): Locator {
        return row.locator('#user-commissions-row-max-amount .grid-item-data');
    }

    accountPlatformCell(row: Locator): Locator {
        return row.locator('#user-commissions-row-platform .grid-item-data');
    }

    accountStatusToggleButton(row: Locator): Locator {
        return row.locator('#user-commissions-row-status-button');
    }

    /**
     * Same race `waitForTransactionTypesResolved` guards against on Default
     * Commission's grid — the account-level grid renders rows immediately
     * with a raw/placeholder transaction-type label and patches in the
     * friendly name once a separate lookup resolves (confirmed live
     * 2026-09-27: an exact-match scan run right after navigation missed a
     * row that demonstrably existed, sending a caller down the create-a-
     * duplicate path instead, which the backend then rejected with 409
     * COMMISSION_ALREADY_EXISTS). Best-effort — doesn't throw.
     */
    private async waitForAccountTransactionTypesResolved(): Promise<void> {
        await this.page.waitForFunction(
            (selector) => Array.from(document.querySelectorAll(selector))
                .every(node => node.textContent?.trim() !== '' && node.textContent?.trim() !== 'Loading...'),
            '#user-commissions-row-transaction-type .grid-item-data',
            { timeout: 5000 },
        ).catch(() => { /* best-effort — see comment above */ });
    }

    /**
     * Finds the account-level row for an exact transaction-type label (e.g.
     * "Merchant Cashin"). Unlike Default Commission's `findRowByTransactionType`,
     * this doesn't page through results — every account observed live carries
     * only a handful of override rows (its own eligible transaction types),
     * never Default Commission's full paginated catalog.
     */
    async findAccountRowByTransactionType(transactionType: string): Promise<Locator | null> {
        await Promise.race([
            this.accountCommissionRows.first().waitFor({ state: 'visible', timeout: 15000 }),
            this.page.getByText(/No Data Found/i).waitFor({ state: 'visible', timeout: 15000 }),
        ]).catch(() => { /* best-effort */ });
        if (await this.accountCommissionRows.count() === 0) return null;
        await this.waitForAccountTransactionTypesResolved();
        const escaped = transactionType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const row = this.accountCommissionRows.filter({
            has: this.page.locator('#user-commissions-row-transaction-type .grid-item-data', {
                hasText: new RegExp(`^\\s*${escaped}\\s*$`),
            }),
        });
        return (await row.count()) > 0 ? row.first() : null;
    }

    /**
     * Creates a new account-level commission override end-to-end: category →
     * transaction type (the "Choose <Category> Transaction" checkbox this
     * account is eligible for) → values → Confirm. Reuses the same wizard
     * steps as `createCommission` — the underlying mechanism
     * (`chooseAccountType`) matches by the checkbox's own label text, which
     * for this screen already IS the exact transaction-type name (e.g.
     * "Merchant Cashin"), not a separate account-type prefix. Caller must
     * already be on that account's Accounts Commission page (see
     * `openAccountCommissionsByMobile`).
     */
    async createAccountCommission(category: string, transactionType: string, values: CommissionFormValues): Promise<void> {
        await this.openAddNewCommission();
        await this.chooseCommissionCategory(category);
        await this.chooseAccountType(transactionType);
        await this.fillCommissionValues(values);
        await this.confirmAndWaitClosed();
    }

    /** Opens the edit-pencil form for an account-level row, applies `values`, and confirms — same shared modal as `editCommission`. */
    async editAccountCommission(row: Locator, values: CommissionFormValues): Promise<void> {
        await this.openEditForm(row);
        await this.fillCommissionValues(values);
        await this.confirmAndWaitClosed();
    }

    /**
     * Activates a disabled account-level row. Mirrors `activateRow` — the
     * only difference confirmed live 2026-09-27 is the status dropdown's own
     * item id suffix (`-status-option-true` here vs Default's
     * `-status-item-true`).
     */
    async activateAccountRow(row: Locator): Promise<void> {
        await this.recoverFromExpiredSession();
        if (await this.isRowActive(row)) return;
        await this.accountStatusToggleButton(row).click();
        const activateItem = this.page.locator('#user-commissions-row-status-option-true:visible').first();
        await activateItem.waitFor({ state: 'visible', timeout: 5000 });
        await activateItem.click();
        const confirmActivate = this.page.getByRole('button', { name: /^Activate$/i });
        await confirmActivate.waitFor({ state: 'visible', timeout: 5000 });
        await confirmActivate.click();
        await expect(this.statusBadge(row), 'account-commission row status flips to Active after confirming Activate').toHaveClass(/status-active/, { timeout: 10000 });
    }

    /**
     * Disables an active account-level row — there is no delete for these
     * rows (confirmed live: only the Activate/Disable dropdown), so this is
     * the only way to undo a test-created override afterwards. The
     * `-status-option-false` id is assumed by symmetry with the confirmed
     * `-status-option-true` (not yet independently confirmed live).
     */
    async disableAccountRow(row: Locator): Promise<void> {
        await this.recoverFromExpiredSession();
        if (!(await this.isRowActive(row))) return;
        await this.accountStatusToggleButton(row).click();
        const disableItem = this.page.locator('#user-commissions-row-status-option-false:visible').first();
        await disableItem.waitFor({ state: 'visible', timeout: 5000 });
        await disableItem.click();
        const confirmDisable = this.page.getByRole('button', { name: /^Disable$/i });
        await confirmDisable.waitFor({ state: 'visible', timeout: 5000 });
        await confirmDisable.click();
        await expect(this.statusBadge(row), 'account-commission row status flips to Disable after confirming Disable').toHaveClass(/status-inactive/, { timeout: 10000 });
    }
}

/** Converts one `apiFetchAllCommissions`/`apiFindCommission` entry to the same shape `readCurrentValues`/UI callers already work with. */
export function apiEntryToFormValues(entry: DefaultCommissionApiEntry): CommissionFormValues {
    return {
        platform: entry.platformType.toUpperCase() as CommissionFormValues['platform'],
        minimumAmount: String(entry.min),
        maximumAmount: String(entry.max),
        value: String(entry.amountValue),
        isPercentage: entry.type === 'PERCENTAGE',
    };
}
