import { test, expect } from '@playwright/test';
import { loginToTopup, gotoTopupScreen, type TopupSession, TOPUP_UI_ACCOUNT } from '../TopupHelper';

// UI — account preferences reachable from the profile dropdown on the Topup
// screen: language (Arabic <-> English) and dark mode. Both change persistent
// account/UI state, so every test restores the original value in `finally`
// — a failed assertion must never leave the shared dev account switched.
// Exact English copy isn't confirmed, so the language checks assert direction
// and the absence of Arabic script rather than a guessed translation.

const ARABIC_SCRIPT = /[؀-ۿ]/;

test.describe('Topup – UI – Language and dark mode', () => {
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

    const direction = (): Promise<string> =>
        session.page.evaluate(() => getComputedStyle(document.body).direction);

    test('the language button shows the current language', async () => {
        const { shell } = session;
        await shell.openProfileMenu();
        await expect(shell.languageButton).toContainText(/العربية|Arabic/i);
        await shell.closeProfileMenu();
    });

    test('switching the language to English flips the page to LTR and drops the Arabic title', async () => {
        const { page, shell, topup } = session;
        expect(await direction()).toBe('rtl');
        try {
            await shell.chooseLanguage('en');
            await expect.poll(direction, { timeout: 15000 }).toBe('ltr');
            await expect(topup.pageTitle).not.toHaveText(ARABIC_SCRIPT);
            await expect(shell.topupLink).not.toHaveText(ARABIC_SCRIPT);
        } finally {
            // Restore Arabic whatever happened above.
            if ((await direction()) !== 'rtl') {
                await shell.chooseLanguage('ar');
                await expect.poll(direction, { timeout: 15000 }).toBe('rtl');
            }
            await page.keyboard.press('Escape');
        }
    });

    test('the chosen language survives a reload', async () => {
        const { page, shell } = session;
        try {
            await shell.chooseLanguage('en');
            await expect.poll(direction, { timeout: 15000 }).toBe('ltr');
            await page.reload();
            await page.waitForLoadState('domcontentloaded');
            await expect.poll(direction, { timeout: 15000 }).toBe('ltr');
        } finally {
            if ((await direction()) !== 'rtl') {
                await shell.chooseLanguage('ar');
                await expect.poll(direction, { timeout: 15000 }).toBe('rtl');
            }
            await page.keyboard.press('Escape');
        }
    });

    test('dark mode toggles the page theme and can be switched back', async () => {
        const { page, shell } = session;
        const background = (): Promise<string> =>
            page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        // The switch is a custom control: Playwright's check()/uncheck() wait for
        // the checked state to flip and hang on it, so click the input directly.
        const toggle = () => shell.darkModeToggle.evaluate((el: HTMLInputElement) => el.click());
        const before = await background();
        await shell.openProfileMenu();
        const wasChecked = await shell.darkModeToggle.evaluate((el: HTMLInputElement) => el.checked);
        let failure: unknown = null;
        try {
            await toggle();
            await expect.poll(background, { timeout: 10000 }).not.toBe(before);
        } catch (e) {
            failure = e;
        }
        // Restore whatever the account had before the test — and never let a
        // problem here mask the real failure above.
        try {
            if (!(await shell.profileMenu.isVisible().catch(() => false))) await shell.openProfileMenu();
            const nowChecked = await shell.darkModeToggle.evaluate((el: HTMLInputElement) => el.checked, undefined, { timeout: 10000 });
            if (nowChecked !== wasChecked) await toggle();
            await page.keyboard.press('Escape');
        } catch (e) {
            failure ??= e;
        }
        if (failure) throw failure;
        await expect.poll(background, { timeout: 10000 }).toBe(before);
    });
});
