import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Combobox recipient-field cells (oinbox 0.8.0 follow-ups, quick 261002-ekf) on
 * all 6 targets, driven against examples/demos/ComboboxRecipientDemo.rozie:
 *   F1 a delimited paste inserts the rejected remainder at the caret; splitPaste
 *   F3 validate normalises (returns the string to store)
 *   F4 search fires { query: '' } when Combobox clears the input itself; query()
 *   F5 commitOnBlur
 *   F6 default-configured instances get distinct ids
 *
 * Behavioral assertions only — no `toHaveScreenshot` (feedback_vr_linux_baselines).
 * CSS / role locators pierce Lit's open shadow roots.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const POLL = { timeout: 10_000, intervals: [100, 200, 400, 800] };

const toInput = (page: Page) => page.locator('input[aria-label="To"]');
const readout = async (page: Page, id: string) =>
  ((await page.getByTestId(id).textContent()) ?? '').trim();

async function open(page: Page, target: string) {
  await page.goto(`/?example=ComboboxRecipient&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  await expect(toInput(page)).toBeVisible({ timeout: 15_000 });
}

// Dispatch a real ClipboardEvent at the input's current caret / selection.
async function paste(page: Page, text: string) {
  await toInput(page).evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true, composed: true }));
  }, text);
}

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = built ? test : test.fixme;

  runner(`combobox-recipient [${target}]: a delimited paste keeps the typed text (remainder at the caret); splitPaste + normalising validate`, async ({ page }) => {
    await open(page, target);
    const input = toInput(page);
    await input.focus();

    // ---- F1: type `ann@`, paste `corp.com, bob@x.test` ----
    await input.pressSequentially('ann@');
    await paste(page, 'corp.com, bob@x.test');
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["seed@x.com","bob@x.test"]');
    await expect(input).toHaveValue('ann@corp.com');
    await expect.poll(async () => readout(page, 'readout-last-search'), POLL).toBe('"ann@corp.com"');
    const caret = await input.evaluate((el) => (el as HTMLInputElement).selectionStart);
    expect(caret).toBe('ann@corp.com'.length);

    // Enter commits the completed address and clears the input → search "".
    await page.keyboard.press('Enter');
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["seed@x.com","bob@x.test","ann@corp.com"]');
    await expect(input).toHaveValue('');
    await expect.poll(async () => readout(page, 'readout-last-search'), POLL).toBe('""');

    // ---- F1 splitPaste (quote-aware) + F3 validate stores the bare address ----
    await paste(page, '"Roe, Sam" <Sam@X.test>; Dee <dee@x.test>');
    await expect
      .poll(async () => readout(page, 'readout-to'), POLL)
      .toBe('["seed@x.com","bob@x.test","ann@corp.com","sam@x.test","dee@x.test"]');
    await expect(input).toHaveValue('');
  });

  runner(`combobox-recipient [${target}]: a duplicate free-text commit fires search ""; query(); commitOnBlur`, async ({ page }) => {
    await open(page, target);
    const input = toInput(page);
    await input.focus();

    // ---- F4: duplicate commit clears the input and still tells the host ----
    await input.pressSequentially('seed@x.com');
    await expect.poll(async () => readout(page, 'readout-last-search'), POLL).toBe('"seed@x.com"');
    await page.getByTestId('read-query').dispatchEvent('mousedown');
    await expect.poll(async () => readout(page, 'readout-query'), POLL).toBe('"seed@x.com"');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('');
    await expect.poll(async () => readout(page, 'readout-last-search'), POLL).toBe('""');
    expect(await readout(page, 'readout-to')).toBe('["seed@x.com"]');
    await page.getByTestId('read-query').dispatchEvent('mousedown');
    await expect.poll(async () => readout(page, 'readout-query'), POLL).toBe('""');

    // ---- F5: commitOnBlur commits a valid address (normalised) on blur ----
    await input.pressSequentially('Eve <eve@x.test>');
    await page.getByTestId('elsewhere').click();
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["seed@x.com","eve@x.test"]');
    await expect(input).toHaveValue('');

    // ... and leaves rejected text alone.
    await input.focus();
    await input.pressSequentially('not-an-address');
    await page.getByTestId('elsewhere').click();
    await page.waitForTimeout(200);
    await expect(input).toHaveValue('not-an-address');
    expect(await readout(page, 'readout-to')).toBe('["seed@x.com","eve@x.test"]');
  });

  runner(`combobox-recipient [${target}]: default-configured instances never share ids`, async ({ page }) => {
    await open(page, target);
    const labels = ['To', 'First', 'Second'];
    const controls: string[] = [];
    for (const label of labels) {
      const input = page.locator(`input[aria-label="${label}"]`);
      await expect
        .poll(async () => (await input.getAttribute('aria-controls')) ?? '', POLL)
        .toMatch(/^rozie-combobox-\d+-list$/);
      controls.push((await input.getAttribute('aria-controls')) ?? '');
    }
    expect(new Set(controls).size).toBe(3);
  });
}
