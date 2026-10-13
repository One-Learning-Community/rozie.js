import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 64 P4 (SC-5) — WINDOWED long-list select behavioral matrix. The select
 * analog of data-table-virtual.spec.ts: a 1,000-option list fed to the pure-Rozie
 * Select with `:virtual` (inline, bounded) renders ONLY a small windowed
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
 * and/or (Lit) the nested Select's OWN open shadow root. The page.evaluate helpers
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

// WR-02: a missing/failed target sub-build must HARD-FAIL in CI rather than
// silently passing as a skipped (test.fixme) matrix. This windowing matrix is the
// ONLY behavioral proof the feature has — CR-01 (hide-on-close) and CR-02 (key
// stability) are exactly the regressions it must catch — so "no build ⇒ green" is a
// false-confidence hazard. The per-target test.fixme on a missing entry (runnerFor
// above) is retained ONLY for local iteration, gated behind ROZIE_VR_TARGETS — the
// same partial-build escape hatch build-cells.mjs uses (build-cells.mjs:673-699). CI
// leaves ROZIE_VR_TARGETS unset, so the up-front gate below asserts every target's
// host entry was built and fails loudly if any are missing.
const PARTIAL_LOCAL_BUILD = (process.env.ROZIE_VR_TARGETS ?? '').trim().length > 0;

if (!PARTIAL_LOCAL_BUILD) {
  test('select-virtual: all six target host entries are built (CI gate — no silent skip)', () => {
    const missing = TARGETS.filter(
      (t) => !existsSync(resolve(__dirname, `../dist/${t}/host/entry.${t}.html`)),
    );
    expect(
      missing,
      `missing VR host build(s): ${missing.join(', ') || '(none)'} — run the VR build-cells step before the windowing matrix`,
    ).toEqual([]);
  });
}

const SCROLL = '.rozie-select-list';

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

/** Open the windowed select (focus the control + ArrowDown) and wait for options. */
async function openSelect(page: Page): Promise<void> {
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
  runnerFor(target)(`select-virtual [${target}]: 1000 options window to a small rendered slice (< 100)`, async ({
    page,
  }) => {
    await page.goto(`/?example=SelectVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openSelect(page);

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
  runnerFor(target)(`select-virtual [${target}]: ArrowDown past the window scrolls the windowed list`, async ({
    page,
  }) => {
    await page.goto(`/?example=SelectVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openSelect(page);
    await scrollWindowTo(page, 0);
    expect(await scrollTopOf(page)).toBe(0);

    // Drive the active highlight far down past the visible window. Paced at a realistic
    // keyboard cadence (~20ms) — a zero-delay burst outpaces Solid's windowed re-render and
    // the browser clamps scrollTop mid-churn (the D-09 Solid windowing-settling fragility);
    // at any real input speed the windowed scroll tracks the active option on all 6 targets.
    for (let i = 0; i < 60; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(20); }

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
  runnerFor(target)(`select-virtual [${target}]: selection survives scroll out + back`, async ({
    page,
  }) => {
    await page.goto(`/?example=SelectVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openSelect(page);
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
  runnerFor(target)(`select-virtual [${target}]: aria-activedescendant tracks the active option as the window scrolls`, async ({
    page,
  }) => {
    await page.goto(`/?example=SelectVirtual&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');

    await openSelect(page);

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
    // Paced at a realistic keyboard cadence (see B2 — D-09 Solid windowing-settling).
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

// ════════════════════════════════════════════════════════════════════════════════════
// B5 — End / Home: the window scrolls to the edge on the SAME key press.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`select-virtual [${target}]: End renders and highlights the last of 1000 options; Home the first`, async ({
    page,
  }) => {
    await page.goto(`/?example=SelectVirtual&target=${target}`);
    await expect
      .poll(async () => page.getByTestId('option-count').textContent(), { timeout: 20_000 })
      .toBe('1000');
    await openSelect(page);
    const control = page.locator('[role="combobox"]').first();
    const list = page.locator(SCROLL).first();
    // Whether the option with this data-index is rendered entirely inside the list's visible box.
    const inView = (index: number) => async () => {
      const l = await list.boundingBox();
      const opt = page.locator(`[role="option"][data-index="${index}"]`);
      if ((await opt.count()) !== 1) return false;
      const o = await opt.boundingBox();
      return !!l && !!o && o.y >= l.y - 1 && o.y + o.height <= l.y + l.height + 1;
    };

    // ONE key press each: nothing else is pressed before the assertions.
    await page.keyboard.press('End');
    await expect(control).toHaveAttribute('aria-activedescendant', /-opt-999$/);
    await expect.poll(inView(999), { timeout: 15_000 }).toBe(true);
    await expect(page.locator('[role="option"][data-index="999"]')).toHaveText('Option 1000');
    await expect(page.locator('[role="option"][data-index="999"]')).toHaveClass(/is-active/);
    expect(await page.locator('[role="option"]').count()).toBeLessThan(100);

    await page.keyboard.press('Home');
    await expect(control).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await expect.poll(inView(0), { timeout: 15_000 }).toBe(true);
    await expect(page.locator('[role="option"][data-index="0"]')).toHaveText('Option 1');
    await expect.poll(async () => scrollTopOf(page)).toBe(0);

    // From a CLOSED list too: End opens it and lands on the last option.
    await page.keyboard.press('Escape');
    await expect(control).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('End');
    await expect(control).toHaveAttribute('aria-expanded', 'true');
    await expect(control).toHaveAttribute('aria-activedescendant', /-opt-999$/);
    await expect.poll(inView(999), { timeout: 15_000 }).toBe(true);

    // Hovering an option moves the highlight WITHOUT scrolling the list. First let the
    // end position settle (the options that were hidden re-measure for a few frames).
    let before: number | null = -1;
    await expect
      .poll(async () => { const t = await scrollTopOf(page); const same = t === before; before = t; return same; }, { intervals: [300], timeout: 15_000 })
      .toBe(true);
    expect(await inView(999)()).toBe(true);
    // The TOP-most option fully in view: were hover to scroll, centring it would move the list.
    const edge = await list.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const rows = Array.from(el.querySelectorAll('[role="option"][data-index]'));
      const first = rows.find((r) => r.getBoundingClientRect().top >= box.top);
      return first ? Number(first.getAttribute('data-index')) : -1;
    });
    expect(edge).toBeGreaterThan(900);
    expect(edge).toBeLessThan(996);
    await page.locator(`[role="option"][data-index="${edge}"]`).hover();
    await expect(control).toHaveAttribute('aria-activedescendant', new RegExp(`-opt-${edge}$`));
    await page.waitForTimeout(300);
    expect(await scrollTopOf(page)).toBe(before);
  });
}
