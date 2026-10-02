import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Combobox token-input behavioral cells (release-0.8.0 COMBOBOX-SPEC) on all 6
 * targets, driven against examples/demos/ComboboxTokenInputDemo.rozie:
 * `block`, `chipLayout="inline"`, `disableOpenOnFocus`, `hideEmpty` (+ B4
 * Escape not consumed), `delimiters`, paste split, `validate`, Enter-without-
 * highlight free-text commit, `selectOnTab`, plain Tab, `activeOption()`, B9
 * Ctrl+Enter, B10 IME composition, B12 chip-slot `remove()` refocus.
 *
 * Behavioral assertions only — no `toHaveScreenshot` (feedback_vr_linux_baselines).
 * CSS / role locators pierce Lit's open shadow roots.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const POLL = { timeout: 10_000, intervals: [100, 200, 400, 800] };

const toInput = (page: Page) => page.locator('input[aria-label="To"]');
const plainInput = (page: Page) => page.locator('input[aria-label="Plain"]');
const readout = async (page: Page, id: string) =>
  ((await page.getByTestId(id).textContent()) ?? '').trim();

// Shadow-aware "is this element the deepest active element?" check.
const isDeepActive = (page: Page, ariaLabel: string) =>
  page.evaluate((label) => {
    let a: Element | null = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return !!a && a.getAttribute('aria-label') === label;
  }, ariaLabel);

const deepActiveTestId = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
    return a ? a.getAttribute('data-testid') : null;
  });

async function open(page: Page, target: string) {
  await page.goto(`/?example=ComboboxTokenInput&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  await expect(toInput(page)).toBeVisible({ timeout: 15_000 });
  await expect(plainInput(page)).toBeVisible({ timeout: 15_000 });
}

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = built ? test : test.fixme;

  runner(`combobox-token-input [${target}]: block fills the container; inline chips share the input row; focus does not open; hideEmpty hides the popup and leaves Escape alone`, async ({ page }) => {
    await open(page, target);
    const input = toInput(page);

    // ---- block: the control spans the 480px container ----
    const container = await page.getByTestId('token-container').boundingBox();
    const control = await page.locator('.rozie-combobox-control').first().boundingBox();
    expect(container).not.toBeNull();
    expect(control).not.toBeNull();
    expect(Math.abs(control!.width - container!.width)).toBeLessThanOrEqual(2);
    const root = await page.locator('.rozie-combobox--block').first().boundingBox();
    expect(Math.abs(root!.width - container!.width)).toBeLessThanOrEqual(2);

    // ---- chipLayout="inline": the seeded chip and the input share one row ----
    const chip = await page.locator('.rozie-combobox--block .rozie-combobox-chip').first().boundingBox();
    const inputBox = await input.boundingBox();
    expect(chip).not.toBeNull();
    expect(inputBox).not.toBeNull();
    expect(inputBox!.x).toBeGreaterThan(chip!.x + chip!.width - 1);
    const chipMid = chip!.y + chip!.height / 2;
    const inputMid = inputBox!.y + inputBox!.height / 2;
    expect(Math.abs(chipMid - inputMid)).toBeLessThanOrEqual(6);

    // ---- disableOpenOnFocus: focus alone opens nothing (even with suggestions) ----
    await page.getByTestId('load-suggestions').click();
    await input.focus();
    await page.waitForTimeout(300);
    await expect(page.locator('#token-to-list')).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    // ArrowDown still opens it.
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => page.locator('#token-to-list [role="option"]').count(), POLL).toBe(2);
    await expect(input).toHaveAttribute('aria-expanded', 'true');

    // ---- hideEmpty: no suggestions → no list, aria-expanded false, Escape untouched ----
    await page.evaluate(() => {
      const w = window as unknown as { __escPrevented?: boolean[] };
      w.__escPrevented = [];
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // read after all target-phase handlers ran
          setTimeout(() => w.__escPrevented!.push(e.defaultPrevented), 0);
        }
      }, true);
    });
    await page.getByTestId('clear-suggestions').click();
    await input.focus();
    await input.pressSequentially('zz');
    await page.waitForTimeout(300);
    await expect(page.locator('#token-to-list')).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expect
      .poll(async () => page.evaluate(() => (window as unknown as { __escPrevented: boolean[] }).__escPrevented), POLL)
      .toEqual([false]);
  });

  runner(`combobox-token-input [${target}]: delimiter commit, paste split, validate reject, Enter-without-highlight commit`, async ({ page }) => {
    await open(page, target);
    const input = toInput(page);
    await input.focus();

    // ---- delimiter ',' commits the typed text ----
    await input.pressSequentially('a@x.com,');
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["seed@x.com","a@x.com"]');
    await expect(input).toHaveValue('');
    await expect.poll(async () => readout(page, 'readout-last-change'), POLL).toBe(
      JSON.stringify({ value: ['seed@x.com', 'a@x.com'], option: null, selected: true, text: 'a@x.com' }),
    );

    // ---- paste split on delimiters ----
    await input.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'b@x.com; c@x.com');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true, composed: true }));
    });
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["seed@x.com","a@x.com","b@x.com","c@x.com"]');

    // ---- validate rejects: text stays in the input, nothing committed ----
    await input.pressSequentially('nope');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await expect(input).toHaveValue('nope');
    expect(await readout(page, 'readout-to')).toBe('["seed@x.com","a@x.com","b@x.com","c@x.com"]');

    // ---- Enter with no highlighted option commits typed text ----
    await input.fill('');
    await input.pressSequentially('d@x.com');
    await page.keyboard.press('Enter');
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["seed@x.com","a@x.com","b@x.com","c@x.com","d@x.com"]');
    await expect(input).toHaveValue('');
  });

  runner(`combobox-token-input [${target}]: selectOnTab picks the highlight; activeOption(); chip-slot remove() refocuses the input`, async ({ page }) => {
    await open(page, target);
    const input = toInput(page);
    await page.getByTestId('load-suggestions').click();
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => page.locator('#token-to-list [role="option"]').count(), POLL).toBe(2);
    await expect(input).toHaveAttribute('aria-activedescendant', 'token-to-opt-0', { timeout: 10_000 });

    // activeOption() → the highlighted raw source option.
    await page.getByTestId('read-active-to').dispatchEvent('mousedown');
    await expect.poll(async () => readout(page, 'readout-active'), POLL).toBe('dana@x.com');

    // Tab picks it and keeps focus in the input.
    await page.keyboard.press('Tab');
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["seed@x.com","dana@x.com"]');
    expect(await isDeepActive(page, 'To')).toBe(true);

    // chip-slot remove() removes the chip and refocuses the input.
    await page.getByTestId('custom-remove-0').focus();
    expect(await isDeepActive(page, 'To')).toBe(false);
    await page.keyboard.press('Enter');
    await expect.poll(async () => readout(page, 'readout-to'), POLL).toBe('["dana@x.com"]');
    await expect.poll(async () => isDeepActive(page, 'To'), POLL).toBe(true);
  });

  runner(`combobox-token-input [${target}]: Ctrl+Enter and IME-composing Enter never pick; activeOption() null when closed`, async ({ page }) => {
    await open(page, target);
    const input = plainInput(page);

    await page.getByTestId('read-active').dispatchEvent('mousedown');
    await expect.poll(async () => readout(page, 'readout-active'), POLL).toBe('null');

    await input.focus();
    await expect.poll(async () => page.locator('#token-plain-list [role="option"]').count(), POLL).toBe(3);
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', /token-plain-opt-\d/, { timeout: 10_000 });

    // B9: Ctrl+Enter does not pick.
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(200);
    expect(await readout(page, 'readout-plain')).toBe('[]');

    // B10: an Enter during an IME composition does not pick.
    await input.evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true, composed: true }));
    });
    await page.waitForTimeout(200);
    expect(await readout(page, 'readout-plain')).toBe('[]');

    // Plain Enter does pick (control).
    await page.keyboard.press('Enter');
    await expect.poll(async () => readout(page, 'readout-plain'), POLL).not.toBe('[]');
  });

  runner(`combobox-token-input [${target}]: plain Tab (no selectOnTab) moves focus out of an open combobox without picking`, async ({ page }) => {
    await open(page, target);
    const input = plainInput(page);
    await input.focus();
    await expect.poll(async () => page.locator('#token-plain-list [role="option"]').count(), POLL).toBe(3);
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'token-plain-opt-0', { timeout: 10_000 });
    await page.keyboard.press('Tab');
    await expect.poll(async () => deepActiveTestId(page), POLL).toBe('after-plain');
    expect(await readout(page, 'readout-plain')).toBe('[]');
  });
}
