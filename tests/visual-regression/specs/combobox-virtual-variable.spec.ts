import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick 260923-rrr — N-05's twin on the Combobox host. RED-first.
 *
 * Combobox (like Listbox) carries their own copy of the data-table host's remeasure sweep: a
 * microtask + ONE rAF handing each rendered option to virtual-core's measureElement. React and
 * Angular commit the recycled window after that rAF, so the new options were only measured when
 * virtual-core's 150ms scrolling-ended tick fired — and with variable-height options the
 * above-viewport scroll adjustment then moved the whole list after the user had already seen it.
 * Asserted as the user sees it: the topmost visible option and its pixel offset at 100ms are the
 * ones still there at 800ms.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return built ? test : test.fixme;
}

/** The listbox scroll container's topmost visible option (data-index) and its offset. */
async function topVisibleOption(page: Page): Promise<{ idx: string | null; off: number | null }> {
  return page.evaluate(() => {
    const deep = (sel: string, root: Document | ShadowRoot = document): Element | null => {
      const d = root.querySelector(sel);
      if (d) return d;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) { const f = deep(sel, sr); if (f) return f; }
      }
      return null;
    };
    const sc = deep('.rozie-combobox-list') as HTMLElement | null;
    if (!sc) return { idx: null, off: null };
    const top = sc.getBoundingClientRect().top;
    const opts = Array.from(sc.querySelectorAll('[role="option"][data-index]')) as HTMLElement[];
    const vis = opts
      .filter((o) => o.getBoundingClientRect().bottom > top + 1)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    return vis
      ? { idx: vis.getAttribute('data-index'), off: Math.round((vis.getBoundingClientRect().top - top) * 10) / 10 }
      : { idx: null, off: null };
  });
}

for (const target of TARGETS) {
  runnerFor(target)(`combobox-virtual-variable [${target}]: after a scrollbar jump the list settles within a few frames and does not lurch later`, async ({ page }) => {
    await page.goto(`/?example=ComboboxVirtualVariable&target=${target}`);
    await expect.poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 }).toBe('1000');
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => (await topVisibleOption(page)).idx, { timeout: 15_000 }).not.toBeNull();
    await page.evaluate(() => {
      const deep = (sel: string, root: Document | ShadowRoot = document): HTMLElement | null => {
        const d = root.querySelector(sel) as HTMLElement | null;
        if (d) return d;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) { const f = deep(sel, sr); if (f) return f; }
        }
        return null;
      };
      const sc = deep('.rozie-combobox-list');
      if (sc) sc.scrollTop = sc.scrollHeight * 0.4;
    });
    await page.waitForTimeout(100);
    const early = await topVisibleOption(page);
    await page.waitForTimeout(700);
    const late = await topVisibleOption(page);
    expect(late.idx, `early=${JSON.stringify(early)} late=${JSON.stringify(late)}`).toBe(early.idx);
    expect(Math.abs((late.off ?? 0) - (early.off ?? 0))).toBeLessThanOrEqual(1);
  });
}

// D-19 twin (quick 260923-rrr): scrolled to the END, the list stays at the end while the options
// in view measure taller than their estimate (measured before the fix: vue/angular 38px short,
// the last option cut off).
for (const target of TARGETS) {
  runnerFor(target)(`combobox-virtual-variable [${target}]: a list scrolled to the end stays at the end`, async ({ page }) => {
    await page.goto(`/?example=ComboboxVirtualVariable&target=${target}`);
    await expect.poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 }).toBe('1000');
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => (await topVisibleOption(page)).idx, { timeout: 15_000 }).not.toBeNull();
    const gap = () => page.evaluate(() => {
      const deep = (sel: string, root: Document | ShadowRoot = document): HTMLElement | null => {
        const d = root.querySelector(sel) as HTMLElement | null;
        if (d) return d;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) { const f = deep(sel, sr); if (f) return f; }
        }
        return null;
      };
      const sc = deep('.rozie-combobox-list')!;
      return Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight);
    });
    await page.evaluate(() => {
      const deep = (sel: string, root: Document | ShadowRoot = document): HTMLElement | null => {
        const d = root.querySelector(sel) as HTMLElement | null;
        if (d) return d;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) { const f = deep(sel, sr); if (f) return f; }
        }
        return null;
      };
      const sc = deep('.rozie-combobox-list')!;
      sc.scrollTop = sc.scrollHeight;
    });
    await page.waitForTimeout(800);
    expect(await gap()).toBeLessThanOrEqual(1);
  });
}

// Control for the case above: a user who scrolls UP from the end is not pulled back down.
for (const target of TARGETS) {
  runnerFor(target)(`combobox-virtual-variable [${target}]: control — scrolling up from the end is not pulled back`, async ({ page }) => {
    await page.goto(`/?example=ComboboxVirtualVariable&target=${target}`);
    await expect.poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 }).toBe('1000');
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => (await topVisibleOption(page)).idx, { timeout: 15_000 }).not.toBeNull();
    const scroll = (how: 'end' | 'up' | 'gap') => page.evaluate((how) => {
      const deep = (sel: string, root: Document | ShadowRoot = document): HTMLElement | null => {
        const d = root.querySelector(sel) as HTMLElement | null;
        if (d) return d;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) { const f = deep(sel, sr); if (f) return f; }
        }
        return null;
      };
      const sc = deep('.rozie-combobox-list')!;
      if (how === 'end') sc.scrollTop = sc.scrollHeight;
      if (how === 'up') sc.scrollTop = sc.scrollTop - 300;
      return Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight);
    }, how);
    await scroll('end');
    await page.waitForTimeout(800);
    await scroll('up');
    await page.waitForTimeout(800);
    expect(await scroll('gap')).toBeGreaterThan(200);
  });
}
