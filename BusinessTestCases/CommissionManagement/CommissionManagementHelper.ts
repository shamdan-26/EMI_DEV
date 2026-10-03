import { type Page, type Locator, type Browser, type BrowserContext } from '@playwright/test';
import { AdminOtpConfigPage, createAdminContext } from '../pageElements/Shared/AdminOtpConfigPage';
import { AdminCommissionManagementPage, type CommissionFormValues } from '../pageElements/CommissionManagement/AdminCommissionManagementPage';

export { createAdminContext };

const PLATFORMS = ['WEB', 'APP', 'SYSTEM'] as const;

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random-but-valid set of commission form values: a minimum
 * amount, a maximum comfortably above it, a platform, and a value — capped at
 * 20 when percentage-based (the form is a real percentage field, not an
 * arbitrary number) or a flat amount otherwise.
 */
export function randomCommissionValues(): CommissionFormValues {
    const minimumAmount = randomInt(1, 500);
    const maximumAmount = minimumAmount + randomInt(100, 100000);
    const isPercentage = Math.random() < 0.5;
    const value = isPercentage ? randomInt(1, 20) : randomInt(1, 500);
    return {
        platform: PLATFORMS[randomInt(0, PLATFORMS.length - 1)],
        minimumAmount: String(minimumAmount),
        maximumAmount: String(maximumAmount),
        value: String(value),
        isPercentage,
    };
}

/**
 * Logs into the admin SPA and returns a ready-to-use
 * `AdminCommissionManagementPage`. The admin SPA's login form is identical
 * regardless of which admin screen a spec is exercising next, so this reuses
 * `AdminOtpConfigPage.login()` purely for its login step rather than
 * duplicating that flow — see that file's header comment for why the geolocation
 * context (`createAdminContext`) has to be granted up front.
 */
export async function loginToCommissionManagement(browser: Browser): Promise<{
    context: BrowserContext;
    page: Page;
    commission: AdminCommissionManagementPage;
}> {
    const context = await createAdminContext(browser);
    const page = await context.newPage();
    await new AdminOtpConfigPage(page).login();
    const commission = new AdminCommissionManagementPage(page);
    return { context, page, commission };
}

/**
 * Ensures a default-commission row exists for `transactionType` (the exact
 * grid label, e.g. "Merchant Cashin") and is Active. If missing, creates it
 * via the Add New Commission wizard under `category`, selecting `accountType`
 * (e.g. `ACCOUNT_TYPE.MERCHANT`) in step 2 — kept separate from
 * `transactionType` because the checkbox wording per category isn't
 * guaranteed to match the grid's column text verbatim (only Bank Transfer's
 * has been confirmed). Returns the row Locator, left on whichever page it was
 * found/created on.
 *
 * Does NOT open the edit form or change the row's amount/value fields — call
 * `commission.editCommission(row, values)` afterwards for that (see
 * `randomCommissionValues()` for a ready-made values generator).
 */
export async function ensureCommissionExistsAndActive(
    commission: AdminCommissionManagementPage,
    category: string,
    accountType: string,
    transactionType: string,
    createValues: Parameters<AdminCommissionManagementPage['fillCommissionValues']>[0],
): Promise<Locator> {
    let row = await commission.findRowByTransactionType(transactionType);
    if (!row) {
        await commission.createCommission(category, accountType, createValues);
        row = await commission.findRowByTransactionType(transactionType);
        if (!row) {
            // The list's own re-fetch right after the create-modal closes
            // can transiently race back empty ("No data found" for a grid
            // that demonstrably has rows) — a dev-environment backend blip
            // (see the identical retry in TopupHelper.ts's
            // prepareBillerTopupCommission). A full re-navigation clears
            // whatever caused it; retry once.
            await commission.gotoDefaultCommission();
            row = await commission.findRowByTransactionType(transactionType);
        }
        if (!row) {
            throw new Error(
                `Created a "${accountType}" commission under "${category}" but no row named ` +
                `"${transactionType}" appeared in the Default Commission list afterwards (retried once).`,
            );
        }
        return row;
    }

    await commission.activateRow(row);
    return row;
}

/**
 * Platform-aware counterpart of `ensureCommissionExistsAndActive` — a
 * transaction type can have more than one row, one per platform (e.g. a WEB
 * "Biller Bank Cashin" row and a separate APP one), so this locates by
 * transaction type *and* platform via the filter panel (`findRowByFilter`)
 * rather than `findRowByTransactionType`'s first-match-by-name scan, which
 * would silently pick whichever platform's row happens to render first —
 * see `findRowByFilter`'s header comment for why the filter panel is the
 * reliable way to identify the row regardless of what its grid cell displays.
 */
export async function ensureCommissionExistsAndActiveByPlatform(
    commission: AdminCommissionManagementPage,
    category: string,
    accountType: string,
    transactionType: string,
    platform: CommissionFormValues['platform'],
    createValues: CommissionFormValues,
): Promise<{ row: Locator; values: CommissionFormValues }> {
    let found = await commission.findRowByFilter(transactionType, platform);
    if (!found) {
        await commission.createCommission(category, accountType, { ...createValues, platform });
        found = await commission.findRowByFilter(transactionType, platform);
        if (!found) {
            // See the identical retry in `ensureCommissionExistsAndActive` —
            // the list's own re-fetch right after the create-modal closes
            // can transiently race back empty.
            await commission.gotoDefaultCommission();
            found = await commission.findRowByFilter(transactionType, platform);
        }
        if (!found) {
            throw new Error(
                `Created a new ${platform} "${transactionType}" commission but the filter panel found no ` +
                `matching row afterwards (retried once).`,
            );
        }
    }

    const { row } = found;
    await commission.activateRow(row);
    return found;
}

/**
 * Account-level counterpart of `ensureCommissionExistsAndActive` — ensures a
 * per-account commission override exists and is Active for `transactionType`
 * on the account identified by `mobileNumber`, creating it via the Add New
 * Commission wizard under `category` if missing. Returns the row Locator,
 * left on that account's Accounts Commission page.
 *
 * Pass `companyNumber` whenever the target mobile number might be shared
 * across more than one business account (see `openAccountCommissionsByMobile`'s
 * header comment) — omitting it in that case can silently land on, and
 * mutate, the wrong company's commissions.
 */
export async function ensureAccountCommissionExistsAndActive(
    commission: AdminCommissionManagementPage,
    mobileNumber: string,
    category: string,
    transactionType: string,
    createValues: CommissionFormValues,
    companyNumber?: string,
): Promise<Locator> {
    await commission.openAccountCommissionsByMobile(mobileNumber, companyNumber);
    let row = await commission.findAccountRowByTransactionType(transactionType);
    if (!row) {
        try {
            await commission.createAccountCommission(category, transactionType, createValues);
        } catch (e) {
            // The backend is the definitive answer on whether this row
            // already exists, not our own pre-create scan — a row can still
            // be mid-hydration (raw/placeholder label) at scan time despite
            // `waitForAccountTransactionTypesResolved`'s best-effort wait,
            // which reads as "not found" and sends this down the create path
            // straight into a 409 COMMISSION_ALREADY_EXISTS. Close whatever
            // the failed attempt left open and fall through to the re-scan
            // below rather than treating this as fatal.
            await commission.cancelButton().click().catch(() => { /* modal may already be closed */ });
            await commission.modalOverlay.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { /* best-effort */ });
        }
        row = await commission.findAccountRowByTransactionType(transactionType);
        if (!row) {
            // Same transient-empty-refetch race `ensureCommissionExistsAndActive`
            // retries around — a fresh navigation clears it.
            await commission.openAccountCommissionsByMobile(mobileNumber, companyNumber);
            row = await commission.findAccountRowByTransactionType(transactionType);
        }
        if (!row) {
            throw new Error(
                `Created (or attempted to create) an account-level "${transactionType}" commission under ` +
                `"${category}" for ${mobileNumber} but no matching row appeared afterwards (retried once).`,
            );
        }
        await commission.activateAccountRow(row);
        return row;
    }

    await commission.activateAccountRow(row);
    return row;
}
