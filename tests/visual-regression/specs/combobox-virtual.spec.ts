import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 64 P4 (SC-5) — WINDOWED long-list combobox behavioral matrix. The combobox
 * analog of data-table-virtual.spec.ts: a 1,000-option list fed to the pure-Rozie
 * Combobox with `:virtual` (inline, bounded, :disable-filter so the full set stays in
 * view) renders ONLY a small windowed `[role="option"]` slice — backed by the shared
 * @rozie-ui/headless-core/windowing.rzts math (the same virtual-core bridge data-table
 * uses, wired per-consumer with a no-op pin hook). DOM/behavioral, NOT screenshot. All
 * 6 targets are real assertions.
 *
 *   B1 (slice size) — for 1,000 options only a SMALL windowed `[role="option"]` set
 *      renders (< 100), not all 1,000, on every target.
 *   B2 (arrow-nav window scroll) — ArrowDown past the visible window scrolls the
 *      windowed popup so the newly-active option renders.
 *   B3 (selection survival) — a selection made, then scrolled out of and back into
 *      the window, remains aria-selected (selection lives in the model).
 *   B4 (activedescendant tracking) — aria-activedescendant on the input points at the
 *      active option's id as the window scrolls, and that option is rendered.
 *
 * SHADOW-PIERCE (Lit): the page.evaluate helpers walk all open shadow roots
 * recursively (the data-table-virtual.spec.ts:73-89 pattern).
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Runs locally on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

const SCROLL = '.rozie-combobox-list';

// ── Shadow-piercing helpers (recursive open-shadow-root walker — Lit). ──────────────

async function scrollTopOf(page: Page): Promise<number | null> {
  return page.evaluate((sel) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(sel);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = find(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const el = find(document);
    return el ? (el as HTMLElement).scrollTop : null;
  }, SCROLL);
}

async function scrollWindowTo(page: Page, top: number): Promise<void> {
  await page.evaluate(
    ({ sel, y }) => {
      const find = (root: Document | ShadowRoot): Element | null => {
        const direct = root.querySelector(sel);
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const inner = find(sr);
            if (inner) return inner;
          }
        }
        return null;
      };
      const el = find(document) as HTMLElement | null;
      if (el) el.scrollTop = y;
    },
    { sel: SCROLL, y: top },
  );
}

async function scrollWindowToBottom(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector(sel);
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = find(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const el = find(document) as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, SCROLL);
}

async function activeDescendant(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('input[role="combobox"][aria-activedescendant]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const inner = find(sr);
          if (inner) return inner;
        }
      }
      return null;
    };
    const el = find(document);
    return el ? el.getAttribute('aria-activedescendant') : null;
  });
}

async function idExists(page: Page, id: string): Promise<boolean> {
  return page.evaluate((wantId) => {
    const find = (root: Document | ShadowRoot): boolean => {
      if (root.querySelector(`[id="${wantId}"]`)) return true;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr && find(sr)) return true;
      }
      return false;
    };
    return find(document);
  }, id);
}

/** Open the windowed combobox (focus the input) and wait for options. */
async function openCombobox(page: Page): Promise<void> {
  const input = page.locator('input[role="combobox"]').first();
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.focus();
  await expect
    .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

// ════════════════════════════════════════════════════════════════════════════════════
// B1 — slice size.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`combobox-virtual [${target}]: 1000 options window to a small rendered slice (< 100)`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openCombobox(page);

    await expect
      .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
      .toBeLessThan(100);

    await expect
      .poll(async () => page.locator('[role="option"][data-index]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// B2 — arrow-nav window scroll.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`combobox-virtual [${target}]: ArrowDown past the window scrolls the windowed popup`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openCombobox(page);
    await scrollWindowTo(page, 0);
    expect(await scrollTopOf(page)).toBe(0);

    // Paced at a realistic keyboard cadence (~20ms) — a zero-delay burst outpaces Solid's
    // windowed re-render and the browser clamps scrollTop mid-churn (the D-09 Solid
    // windowing-settling fragility); at any real input speed the scroll tracks on all 6.
    for (let i = 0; i < 60; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(20); }

    await expect
      .poll(async () => scrollTopOf(page), { timeout: 15_000 })
      .toBeGreaterThan(0);

    await expect
      .poll(
        async () => {
          const ad = await activeDescendant(page);
          if (!ad) return false;
          return idExists(page, ad);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// B3 — selection survival.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`combobox-virtual [${target}]: selection survives scroll out + back`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openCombobox(page);
    await scrollWindowTo(page, 0);

    // Select the first windowed option. @mousedown.prevent keeps input focus +
    // closeOnSelect=false keeps the popup open.
    const first = page.locator('[role="option"][data-index]').first();
    const firstIndex = await first.getAttribute('data-index');
    expect(firstIndex).not.toBeNull();
    await first.click();
    await expect(
      page.locator(`[role="option"][data-index="${firstIndex}"]`),
    ).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });

    // Scroll it well out of the window.
    await scrollWindowToBottom(page);
    await expect
      .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect(
      page.locator(`[role="option"][data-index="${firstIndex}"]`),
    ).toHaveCount(0, { timeout: 15_000 });

    // Scroll it back — still selected (selection lives in the model).
    await scrollWindowTo(page, 0);
    const back = page.locator(`[role="option"][data-index="${firstIndex}"]`);
    await expect(back).toHaveCount(1, { timeout: 15_000 });
    await expect(back).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// B4 — activedescendant tracking.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`combobox-virtual [${target}]: aria-activedescendant tracks the active option as the window scrolls`, async ({
    page,
  }) => {
    await page.goto(`/?example=ComboboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openCombobox(page);

    // Drive the active highlight down; the named active option stays rendered. Paced at a
    // realistic keyboard cadence (see B2 — D-09 Solid windowing-settling).
    for (let i = 0; i < 40; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(20); }
    await expect
      .poll(
        async () => {
          const ad = await activeDescendant(page);
          if (!ad) return false;
          return idExists(page, ad);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
}
