# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run all tests against dev
npm run test:dev

# Run a single spec file
npx playwright test BusinessTestCases/Login/ui/LoginPage.spec.ts

# Run a single test by title (substring match)
npx playwright test --grep "should display the login form"

# Run tests in a specific feature folder
npx playwright test BusinessTestCases/Login/

# Open the HTML report after a run
npx playwright show-report

# Show the interactive UI mode
npx playwright test --ui
```

The `ENV` variable selects the environment config (`.env.dev` — the only environment). `cross-env` injects it for you via the npm scripts; when calling `npx playwright test` directly, prefix with `cross-env ENV=dev`.

## Architecture

### Environment & configuration

`playwright.config.ts` loads `.env.<ENV>` via `dotenv` before test discovery, and is the **only** Playwright config in the repo (`testDir: './BusinessTestCases'`). Required env vars:

| Variable | Used by |
|---|---|
| `BASE_URL` | every helper/page object |
| `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER` | OTP fetching from the shared test mailbox (`support/emailOtp.ts`) |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | OAuth2 (XOAUTH2) app-only login to that same mailbox — Exchange Online retired IMAP Basic Auth (`support/emailOtp.ts`) |
| `DEV_COMPANY`, `DEV_MOBILE` | primary shared test account (homepage, bank transfer, login) |
| `DEV_COMPANY_2`, `DEV_MOBILE_2`, ... `_3`, `_4` | additional homepage test accounts — the pool auto-extends as these are added, no code changes needed (see `Homepage/HomePageHelper.ts`) |
| `DEV_SETUP_COMPANY/MOBILE/PASSWORD` | `support/global-setup.ts` |

`support/global-setup.ts` runs once before the suite: it logs in and saves `session.json` (cookies + localStorage), then separately pre-authenticates every account in the homepage account pool into `playwright/.auth/homepage-account<N>.json`. `support/global-teardown.ts` wipes `session.json` afterwards. Tests that need a pre-authenticated session use `test.use({ storageState: 'session.json' })` or `test.use({ storageState: ACCOUNT_1_STORAGE_STATE })`.

### OTP handling

All real-OTP flows read the shared dev test mailbox over IMAP via `fetchOtpFromEmail` (`support/emailOtp.ts`): newest message first within a 10-minute window, body must contain both the target mobile and `Use this OTP` (or a caller-supplied `messageFilter`), OTP digits pulled out by regex, with retry/delay. `getOtpFromDb` in `Registration/RegistrationHelper.ts` and `Login/LoginHelper.ts` both delegate to it (the name is legacy — kept to avoid touching every call site). In `ENV=dev` the OTP is always `00000000` and the mailbox is skipped.

IMAP auth is OAuth2 (XOAUTH2), not a password — the mailbox is a managed Microsoft 365 org account with MFA enforced, and Exchange Online has retired IMAP Basic Auth entirely. `fetchOtpFromEmail` gets an app-only access token via the Entra ID client-credentials flow (`getAccessToken` in the same file), cached until shortly before expiry. This requires an Entra app registration with the `IMAP.AccessAsApp` application permission (Office 365 Exchange Online API), admin consent, and ideally an Exchange `ApplicationAccessPolicy` scoping the app to just this mailbox (application permissions otherwise grant access tenant-wide).

### Toast / snackbar guard

`waitForToastClear` and `assertToast` live in `BusinessTestCases/toastMessages.ts`. `waitForToastClear` is called after every landing-page navigation immediately once the page settles — it waits up to 3 s for a `mat-snack-bar-container` / `[class*="snack"]` / `[class*="toast"]` to appear, then up to 8 s for it to clear, and is a no-op when no toast appears. `assertToast` asserts a toast is visible and optionally contains expected text — used in negative-scenario tests that expect an error/warning toast. This exists because Angular fires background API calls on load that can produce transient error banners in the dev environment.

### Page Object Model

All UI interactions are encapsulated in page objects under `BusinessTestCases/pageElements/`, grouped into one subfolder per feature (`Registration/`, `Homepage/`, `Topup/`, `W2WTransfer/`, `PaymentLinks/`, `Products/`, `PayBill/`, `ForgotPassword/`, `BillManagement/`, `MoneyRequest/`, `QRPayment/`, `PosTransactions/`) plus a `Shared/` folder for page objects used across multiple features (`DashboardPage`, `HomePage`, `OtpPage`, `TransactionsPage`, `LoginPage`, `BankTransferPage`, `HomepageQuickActionsPage`, `HomepageSidebarPage`). Tests never call raw `page.locator()`; that belongs in a page object.

A page object lives in `Shared/` only once it's actually consumed by more than one feature folder — a page object still owned by a single feature belongs in that feature's subfolder even if the class itself is generic in shape. When a feature's last remaining page object moves to `Shared/` this way, its `pageElements/<Feature>/` subfolder disappears entirely (e.g. `Login/` and `BankTransfer/` no longer have a `pageElements/` mirror — `LoginPage` and `BankTransferPage` outgrew single-feature ownership and moved to `Shared/`); the `BusinessTestCases/<Feature>/` test folder itself is unaffected.

**Conventions:**
- Locators are `readonly` Locator properties set once in the constructor — never re-queried per-test.
- Every page object's constructor takes a single `page: Page` argument.
- Action methods (`fill`, `submit`, `next`, `waitForLoad`) hide Playwright implementation details from spec files.
- **`.first()` on `.or()` fallback chains** — a `.or()` chain that gets clicked or existence-checked should end in `.first()` so a testid that resolves to more than one node doesn't throw a strict-mode violation. **Do not** add `.first()` to a locator whose text/value is read back and parsed (e.g. `HomePage.currentBalance`): there the strict-mode error is the wanted signal — `.first()` silently returns whichever node is first in DOM order and quietly yields the wrong number.
- **Prefer a container-scoped selector over a page-wide `[data-testid^="…"]` prefix match** when the result is counted/indexed (`.count()` + `.nth(i)`) — an unscoped prefix match can pick up a matching element retained from an earlier step or a summary preset.
- **`Locator.isVisible({ timeout })` ignores the `timeout`** — it's a synchronous poll. For a bounded "is it there yet?" check use `locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)`.

### Fixtures — how page objects get into tests

The suite has **two session lifecycles**, and each has its own fixtures file extending `@playwright/test`'s `test`/`expect`:

1. **`BusinessTestCases/fixtures.ts`** — for specs that get a fresh `page` per test (the common case). Defines one lazy fixture per page object (all 27 classes), keyed by name (`loginPage`, `dashboard`, `otp`, `homepageBalanceCard`, `registrationInfo`, etc. — see the file for the full list). It also re-exports everything else from `@playwright/test` (`Page`, `Browser`, `expect`, ...), so a spec file only has to change its import source, not add a second import line for types:
   ```typescript
   import { test, expect, type Page } from '../../fixtures'; // was '@playwright/test'

   let loginPage: LoginPage;
   test.beforeEach(async ({ page, loginPage: lp }) => {
       loginPage = lp;
       await loginPage.goto(LOGIN_URL);
   });
   ```
   Fixtures are lazy — only the ones a test actually destructures get constructed, so bundling all of them in one file costs nothing per-test.

2. **`Homepage/HomepageFixtures.ts`** — for the Homepage suite, which shares one authenticated session across every test file a given worker runs (cheaper than re-logging-in per file). This is a **worker-scoped** fixture (`{ scope: 'worker' }`), Playwright's documented pattern for expensive shared setup, built on top of `createHomepageSession`/`refreshHomepage` in `Homepage/HomePageHelper.ts`:
   ```typescript
   import { test, expect, Page } from '../HomepageFixtures'; // was '@playwright/test'

   let page: Page;
   let dashboard: DashboardPage;
   test.beforeEach(async ({ homepagePage, dashboard: d }) => {
       page = homepagePage;
       dashboard = d;
       await refreshHomepage(page);
   });
   ```
   **Exception**: three Homepage files need a *specific* account rather than whichever one the worker was assigned (transaction-history / empty-state fixtures) — `ui/HomepageTransactionsPage.spec.ts`, `functional/HomepageTransactions.spec.ts`, `functional/HomepageTransactionsEmptyState.spec.ts`. These still call `createHomepageSession(browser, 'ACCOUNT_1' | 'ACCOUNT_2')` directly in their own `beforeAll`/`afterAll`, importing straight from `@playwright/test`. Don't migrate them to the worker fixture — that would silently swap their pinned account for whatever the worker's default is.

When adding a new page object, add its fixture to `fixtures.ts` (or `HomepageFixtures.ts` if it's a Homepage widget) rather than instantiating it manually in a spec file.

### Test organisation

```
BusinessTestCases/
  fixtures.ts                 ← shared per-test page-object fixtures (see above)
  toastMessages.ts            ← waitForToastClear, assertToast
  pageElements/
    Shared/                    ← page objects used by more than one feature (DashboardPage, HomePage, OtpPage, TransactionsPage, LoginPage, BankTransferPage, HomepageQuickActionsPage, HomepageSidebarPage)
    Registration/ · Homepage/ · Topup/ · W2WTransfer/
    PaymentLinks/ · Products/ · PayBill/ · ForgotPassword/
    BillManagement/ · MoneyRequest/ · QRPayment/
    BeneficiaryManagement/ · UserManagement/ · SubWallets/ · PosTransactions/
                                 ← one subfolder per feature, holding that feature's page-object class(es);
                                   no Login/ or BankTransfer/ subfolder — their only page objects moved to Shared/;
                                   no Reconciliation/ or TransactionOperations/ mirror — those features are API-only, no page objects;
                                   PosTransactions/ gained a mirror once EMI-6011/6013/6015 shipped the first POS web screens
  Login/
    LoginHelper.ts             ← credentials, OTP helpers, shared constants
    api/ · functional/ · ui/
  Homepage/
    HomePageHelper.ts          ← account pool, createHomepageSession, refreshHomepage
    HomepageFixtures.ts        ← worker-scoped fixtures (see above)
    functional/ · ui/
  ForgotPassword/
    ForgotPasswordHelper.ts    ← mockOtpDisabled, mockForgetPasswordSuccess/Failure, gotoForgotPassword
    api/ · functional/ · ui/
  Registration/
    RegistrationHelper.ts      ← asset pools, step-navigation helpers (goToInfoStep, etc.)
    api/ · functional/ · ui/
  BankTransfer/
    BankTransferHelper.ts
    functional/ · ui/
  PaymentLinks/
    PaymentLinkHelper.ts
    functional/
  Products/
    ProductsPoSHelper.ts
    functional/ · ui/
  Topup/
    TopupHelper.ts               ← also holds the shared "Core Scenarios" setup (loginToTopup,
                                   gotoTopupScreen, findTopupCase, reachCardEntryPopup) the six
                                   functional/Topup*.spec.ts files below all import, so each
                                   testing type stays a thin file instead of repeating login/nav;
                                   also holds the Biller-scoped commission helpers
                                   (prepareBillerTopupCommission, restoreBillerTopupCommission,
                                   ensureAppScopedBillerTopupCommission,
                                   restoreAppScopedBillerTopupCommission) TopupCommission.spec.ts
                                   uses — "Biller Bank Cashin" / ACCOUNT_TYPE.BILLER, not the
                                   Merchant-scoped ones archive/TopupCommission.spec.ts used
    functional/                 ← "Core Scenarios" — one file per testing type, all against the
                                   Biller account (Q9557), ENV=dev:
                                     TopupHappyPath.spec.ts   — VISA/MASTER/MADA, full OTP + gateway
                                       completion, exact-amount balance credit
                                     ui/Topup{Form,Summary,Otp,Gateway,Shell,Success,Failure}UI.spec.ts
                                       — element presence, one file per page/step (amount form,
                                       Add Funds Summary, OTP, gateway hand-off, sidebar/header
                                       shell, Payment Success, Payment Failed); replaces the old
                                       single TopupUI.spec.ts
                                     TopupNegative.spec.ts    — invalid amount, no method selected,
                                       Summary cancel, wrong OTP
                                     TopupSecurity.spec.ts    — card/CVV PCI-iframe isolation
                                     TopupAPI.spec.ts         — POST /api/v1/payments contract (201 +
                                       OTP-initiation)
                                     TopupCommission.spec.ts  — live Default Commission schema for
                                       "Biller Bank Cashin" (TU-CM03/08/13/16/17/18/19/20/21/22/23/
                                       29/31/32), boundaries/value/type-flag read at runtime from
                                       the admin-configured row, never hardcoded; TU-CM13 is the
                                       one case that carries a top-up all the way through OTP/card/
                                       gateway (the rest stop at the Summary screen) — admin edits
                                       the live value, Summary reflects it, the wallet is credited
                                       net of it, SQL base_transaction's commission column matches,
                                       then the original value is restored; TU-CM02/14/15 stay
                                       test.skip() (not yet automatable — see each note)
                                   Limits, SADAD, and declined-payment/session-expiry remain
                                   deliberately out of scope — archived below, not superseded
    archive/                    ← all other Topup functional/ui specs archived (still discovered,
                                   not skipped), including the Merchant-scoped
                                   archive/TopupCommission.spec.ts (superseded by
                                   functional/TopupCommission.spec.ts above, kept for reference) and
                                   the original data-driven TopupFlow.spec.ts; pageElements/Topup/
                                   stays in place — still imported by these archived specs, by every
                                   functional/Topup*.spec.ts above, and by BankTransferHelper.ts's
                                   own card-topup step
  W2WTransfer/
    W2WTransferHelper.ts
    functional/
  PayBill/
    PayBillHelper.ts
    functional/
  BillManagement/
    BillManagementHelper.ts
    functional/ · ui/
  MoneyRequest/
    MoneyRequestHelper.ts
    functional/
  QRPayment/
    QRPaymentHelper.ts
    functional/
  BeneficiaryManagement/         ← Manage Accounts → Manage Beneficiary
    BeneficiaryManagementHelper.ts
    functional/
  UserManagement/                ← Manage Accounts → Manage Users + Access & Permissions
    UserManagementHelper.ts
    functional/ · ui/
  PosTransactions/               ← POS transactions, ledger, ACH transfers, terminal callback, and
                                   the POS/ACH admin web screens
    PosTransactionsHelper.ts     ← API base/paths, headers, token acquisition, MADA callback payload
                                   builder (JSON + XML), plus page.route() mocks for the two web screens
    api/ · ui/                 ← see its README.md for env vars, the ACH money-movement guard, and
                                 observed gateway deviations. No longer API-only: EMI-6011/6013/6015
                                 added ui/ and a pageElements/PosTransactions/ mirror
  Reconciliation/
    ReconciliationHelper.ts
    api/                       ← all specs test.skip() pending Admin Portal / Reconciliation Ops tooling access
  TransactionOperations/
    TransactionOperationsHelper.ts
    api/                       ← all specs test.skip() pending Admin Portal tooling access (reversal/adjustment)
  WalletSnapshot/                ← whole Wallet-Snapshotting epic (EMI-6114–6127). API-only, no page
    WalletSnapshotHelper.ts        objects, no Business Portal UI surface. See docs/business-knowledge/
    api/                          Wallet-Snapshot-Pipeline-Architecture.md for how the specs below map to
                                  the 13 tickets:
                                    WalletSnapshotList.spec.ts / WalletSnapshotDetail.spec.ts — EMI-6127's
                                      admin GETs; unauthenticated-401 checks run for real (confirmed live),
                                      everything needing an admin token is test.skip() pending that access.
                                    WalletSnapshotJob.spec.ts — EMI-6115's on-demand trigger, on an
                                      internal-only host; only the public-gateway-404 check runs for real,
                                      the rest test.skip() pending network access to that host.
                                    WalletSnapshotSchema.spec.ts — EMI-6114's DB schema, runs for real via
                                      support/sqlServerClient.ts (same pattern as TopupHelper.ts).
                                    WalletSnapshotCalculations.spec.ts — EMI-6116/6117/6118/6119/6121/6122/
                                      6123/6126, all internal calculation/validation steps with no endpoint
                                      of their own; test.skip() pending an admin token + a way to trigger a
                                      fresh run.
                                    WalletSnapshotAggregate.spec.ts — EMI-6124's end-to-end composition
                                      (WAG-01) and cross-wallet consistency (WAG-02) checks; failure
                                      isolation is deliberately NOT duplicated here, it's WSJ-08. test.skip()
                                      pending the same trigger + admin-token access as the files above.
                                  Companion Postman collections: postman/WalletSnapshotAdmin-API-majdpay
                                  .postman_collection.json (EMI-6127), postman/WalletSnapshotJob-API-
                                  majdpay.postman_collection.json (EMI-6115, deliberately no auth anywhere
                                  in it), and postman/WalletSnapshotAggregate-API-majdpay.postman_collection
                                  .json (EMI-6124, chains the two above rather than adding new endpoints).
                                  EMI-6114 and EMI-6116–6123/6126 have no independent endpoint, so no
                                  separate collection exists for them — see each ticket's own refined doc.
  ServiceApis/                  ← NOT a feature folder. 27 generated <Service>.generated.spec.ts
    README.md                     scaffolds, one per EMI microservice OpenAPI spec (gateway swagger-ui),
    <Service>.generated.spec.ts   mirrored by postman/<Service>-API-majdpay.postman_collection.json.
                                  Flat (no per-service subfolder, no Helper); every operation is a
                                  test.skip placeholder; the describe blocks only register when
                                  SERVICE_API_SCAFFOLD=true or SERVICE_API_SMOKE=true, so a normal
                                  run discovers nothing here. Curate an endpoint by moving it into
                                  the owning feature folder.
```

Every feature folder under `BusinessTestCases/` (and its mirror under `pageElements/`, where one still exists) is PascalCase. Each `BusinessTestCases/<Feature>/` folder holds one `<Feature>Helper.ts` plus a subset of `api/`, `functional/`, `ui/`, `archive/`; each `pageElements/<Feature>/` folder holds that feature's page-object class(es), named `<Feature>Page.ts` or split further where a feature has multiple distinct pages (e.g. `Registration/`, `Homepage/`). A `pageElements/<Feature>/` mirror only exists while at least one page object is still single-feature — see the `Shared/` promotion rule above.

### Key conventions

- **Serial mode** — every `test.describe` block uses `test.describe.configure({ mode: 'serial' })` because tests within a file often share session state or have a prescribed order (logout must be last, etc.).
- **`functional/` vs `ui/`** — `functional/` covers business logic, interactions, and outcomes; `ui/` covers element/text presence only. The same flow is often exercised in both, deliberately kept separate.
- **Registration asset pools** — `CITIZEN_ASSETS` and `RESIDENT_ASSETS` in `Registration/RegistrationHelper.ts` are fixed CRN/National-ID/mobile tuples. Round-robin helpers (`nextCitizenAsset`, `nextResidentAsset`) cycle through them to avoid duplicate-registration rejections.
- **BankTransfer, Products, and some Registration files** log in once via their own `test.beforeAll`/`browser.newPage()` (not the fixtures above) because each encodes bespoke multi-step login/OTP business logic inline. This is intentional — don't force these onto `fixtures.ts`, which assumes the default per-test `page`.
- **BillManagement, MoneyRequest, and QRPayment** use a third pattern: a local async login helper (`loginAndOpenCreateBill`, `login`, etc.) defined at the top of the spec file and called per-test against the default `@playwright/test` `page` — no shared session across tests, no `fixtures.ts`. This is distinct from both the fixtures.ts and the BankTransfer/Products `beforeAll`-shared-session patterns above; flag before extending it further rather than treating it as a third blessed convention.
- **Reconciliation and TransactionOperations** are API-only, page-object-free *feature* folders (PosTransactions was one until EMI-6011/6013/6015) where every spec is `test.skip(true, ...)` — coverage is written and traceable to its ticket but pending Admin Portal / Reconciliation Ops tooling access, the same rationale already used by `BankTransferCommission.spec.ts`. **WalletSnapshot** is the same API-only shape but partially runnable: its unauthenticated-401 checks are confirmed live and run for real, while every case needing an `ADMIN_GET_WALLET_SNAPSHOTS`-scoped token stays `test.skip()` pending a confirmed pure-API admin sign-in path (there's no admin equivalent of the business-portal `/auth/signin` + `tenantNumber` flow yet).
- **`ServiceApis/`** is a generated scaffold area, not a feature folder — 27 `<Service>.generated.spec.ts` files (one per EMI microservice OpenAPI spec) whose every operation is a `test.skip` placeholder, mirrored by the generated `postman/<Service>-API-majdpay.postman_collection.json` collections and their shared `postman/EMI-dev.postman_environment.json`. The `test.describe` blocks are wrapped in `if (SERVICE_API_SCAFFOLD || SERVICE_API_SMOKE)` so a normal `npm run test:dev` registers nothing from them; `SERVICE_API_SMOKE=true` additionally runs a live "unauthenticated request is rejected" check per path-param-free operation. See `BusinessTestCases/ServiceApis/README.md` and `postman/README.md`. This is deliberately outside the POM/fixture/Helper conventions — treat an endpoint as real coverage only once it is curated into its owning feature folder.
- **Forgot-password tests use route mocking** — `abortUnmockedGatewayRequests` is registered first (LIFO ensures targeted mocks take priority) so tests don't hang on unmocked gateway traffic.
- **Archive folder** — specs moved to `*/archive/` are retired but kept for reference. They are still discovered by Playwright; add `test.skip()` at the describe level if they should not run.
- **Failure artifacts** — `playwright.config.ts` captures `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, and `video: 'retain-on-failure'`; `npx playwright show-report` surfaces all three for a failed run.
