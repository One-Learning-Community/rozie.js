import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/date-picker `focus()` HANDLE behavioral spec.
 *
 * The exposed `focus()` is called from OUTSIDE the picker — DOM focus sits on
 * an unrelated button, the consumer shape the handle exists for (open the
 * picker in a popover, then move the keyboard into the grid). The r-keynav
 * primitive's strict-containment guard (260806-lz7) only auto-focuses when
 * focus is already inside the component, so the handle must land DOM focus
 * itself rather than rely on the active-index change alone.
 *
 * BEHAVIOR-ONLY: focused-element identity, never a screenshot.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return built ? test : test.fixme;
}

/** Shadow-piercing focused-element read (see date-picker-keyboard.spec.ts). */
async function activeElementInfo(page: Page): Promise<{
  testId: string | null;
  dataDay: string | null;
  dataMonth: string | null;
} | null> {
  return page.evaluate(() => {
    const descend = (root: Document | ShadowRoot): Element | null => {
      const active = root.activeElement;
      if (!active) return null;
      const sr = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (sr) {
        const inner = descend(sr);
        if (inner) return inner;
      }
      return active;
    };
    const active = descend(document);
    if (!active) return null;
    return {
      testId: active.getAttribute('data-testid'),
      dataDay: active.getAttribute('data-day'),
      dataMonth: active.getAttribute('data-month'),
    };
  });
}

for (const target of TARGETS) {
  const runner = runnerFor(target);

  runner(`date-picker-focus-handle [${target}]: focus() from outside lands on the active day`, async ({
    page,
  }) => {
    await page.goto(`/?example=DatePickerBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.locator('[data-day="2025-06-15"]')).toBeVisible({ timeout: 10_000 });

    await mount.getByTestId('focus-picker').click();
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .toBe('2025-06-15');

    // The grid is live from there: arrows move relative to the focused day.
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .toBe('2025-06-16');

    // A second call after focus has left again still lands (no one-shot latch).
    await mount.getByTestId('focus-picker').click();
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataDay, { timeout: 10_000 })
      .not.toBeNull();
  });

  runner(`date-picker-focus-handle [${target}]: focus() in the months view lands on the active month`, async ({
    page,
  }) => {
    await page.goto(`/?example=DatePickerBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount.locator('[data-day="2025-06-15"]')).toBeVisible({ timeout: 10_000 });

    await mount.locator('.rozie-datepicker-heading-button').click();
    await expect(mount.locator('[data-month]').first()).toBeVisible({ timeout: 10_000 });

    await mount.getByTestId('focus-picker').click();
    await expect
      .poll(async () => (await activeElementInfo(page))?.dataMonth ?? null, { timeout: 10_000 })
      .not.toBeNull();
  });
}
