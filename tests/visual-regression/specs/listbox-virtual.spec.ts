import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 64 P4 (SC-5) — WINDOWED long-list listbox behavioral matrix. The listbox
 * analog of data-table-virtual.spec.ts: a 1,000-option list fed to the pure-Rozie
 * Listbox with `:virtual` (inline, bounded) renders ONLY a small windowed
 * `[role="option"]` slice — backed by the shared @rozie-ui/headless-core/windowing.rzts
 * math (the same virtual-core bridge data-table uses, wired per-consumer with a no-op
 * pin hook). DOM/behavioral, NOT screenshot (macOS/Linux kerning would flake pixels;
 * windowing invariants are exact DOM facts). All 6 targets are real assertions.
 *
 *   B1 (slice size) — for 1,000 options only a SMALL windowed `[role="option"]` set
 *      renders (< 100), not all 1,000, on every target.
 *   B2 (arrow-nav window scroll) — ArrowDown past the visible window scrolls the
 *      windowed list so the newly-active option renders (the scroll container
 *      scrollTop grows and the active data-index is in the rendered slice).
 *   B3 (selection survival) — a selection made, then scrolled out of and back into
 *      the window, remains aria-selected (selection lives in the model, not the
 *      recycled DOM node).
 *   B4 (activedescendant tracking) — aria-activedescendant on the control points at
 *      the active option's id as the window scrolls, and that option is rendered.
 *
 * SHADOW-PIERCE (Lit): the windowed list lives in the consumer host shadow root
 * and/or (Lit) the nested Listbox's OWN open shadow root. The page.evaluate helpers
 * below walk all open shadow roots recursively (the data-table-virtual.spec.ts:73-89
 * pattern). The plain Playwright role locators auto-pierce open shadow roots for the
 * simple count/visibility reads.
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

const SCROLL = '.rozie-listbox-list';

// ── Shadow-piercing helpers (recursive open-shadow-root walker — Lit). ──────────────

/** The windowed scroll container's scrollTop. null if not found. */
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

/** Scroll the windowed container to `top` (shadow-pierced). */
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

/** Scroll the windowed container to the bottom (shadow-pierced). */
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

/** The control's aria-activedescendant (shadow-pierced). */
async function activeDescendant(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[role="combobox"][aria-activedescendant]');
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

/** Whether an element with this id exists anywhere (shadow-pierced). */
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

/** Open the windowed listbox (focus the control + ArrowDown) and wait for options. */
async function openListbox(page: Page): Promise<void> {
  const control = page.locator('[role="combobox"]').first();
  await expect(control).toBeVisible({ timeout: 15_000 });
  await control.focus();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

// ════════════════════════════════════════════════════════════════════════════════════
// B1 — slice size: 1,000 options window to a SMALL rendered slice.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`listbox-virtual [${target}]: 1000 options window to a small rendered slice (< 100)`, async ({
    page,
  }) => {
    await page.goto(`/?example=ListboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openListbox(page);

    // Only a SMALL windowed [role="option"] set renders for 1,000 options.
    await expect
      .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
      .toBeLessThan(100);

    // The rendered options carry a full-model data-index (windowing maps the slice).
    await expect
      .poll(async () => page.locator('[role="option"][data-index]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// B2 — arrow-nav window scroll: ArrowDown past the window scrolls so the new active
//      option renders.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`listbox-virtual [${target}]: ArrowDown past the window scrolls the windowed list`, async ({
    page,
  }) => {
    await page.goto(`/?example=ListboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openListbox(page);
    await scrollWindowTo(page, 0);
    expect(await scrollTopOf(page)).toBe(0);

    // Drive the active highlight far down past the visible window.
    for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowDown');

    // The windowed list scrolled to keep the active option in view (scrollTop grew).
    await expect
      .poll(async () => scrollTopOf(page), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // The active option (the one the control's aria-activedescendant names) is rendered
    // in the current window.
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
// B3 — selection survival: select, scroll out + back, selection persists.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`listbox-virtual [${target}]: selection survives scroll out + back`, async ({
    page,
  }) => {
    await page.goto(`/?example=ListboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openListbox(page);
    await scrollWindowTo(page, 0);

    // Select the first windowed option (multi-select + closeOnSelect=false keep the popup
    // open). Capture its full-model data-index so we can find it again after recycling.
    const first = page.locator('[role="option"][data-index]').first();
    const firstIndex = await first.getAttribute('data-index');
    expect(firstIndex).not.toBeNull();
    await first.click();
    await expect(
      page.locator(`[role="option"][data-index="${firstIndex}"]`),
    ).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
    await expect
      .poll(async () => page.getByTestId('selected-count').textContent(), { timeout: 15_000 })
      .toBe('1');

    // Scroll that option well out of the rendered window.
    await scrollWindowToBottom(page);
    await expect
      .poll(async () => page.locator('[role="option"]').count(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect(
      page.locator(`[role="option"][data-index="${firstIndex}"]`),
    ).toHaveCount(0, { timeout: 15_000 });

    // Scroll it back in — it is STILL selected (selection lives in the model).
    await scrollWindowTo(page, 0);
    const back = page.locator(`[role="option"][data-index="${firstIndex}"]`);
    await expect(back).toHaveCount(1, { timeout: 15_000 });
    await expect(back).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// B4 — activedescendant tracking: aria-activedescendant names the active option id
//      and that option is rendered as the window scrolls.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`listbox-virtual [${target}]: aria-activedescendant tracks the active option as the window scrolls`, async ({
    page,
  }) => {
    await page.goto(`/?example=ListboxVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openListbox(page);

    // After opening, the control names an active option id and it is in the DOM.
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

    // Drive it down and re-confirm the named active option is rendered (window tracked it).
    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowDown');
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
