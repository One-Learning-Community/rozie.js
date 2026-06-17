import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Slider behavioral smoke — pure-Rozie WAI-ARIA slider / range (`Slider`).
 *
 * `Slider` is the SECOND @rozie-ui component with NO third-party vanilla engine:
 * under Approach B the engine IS the browser's native `<input type="range">` —
 * drag (mouse + touch), keyboard, focus, `role="slider"`, `aria-value*`,
 * step/min/max, disabled, and RTL come from the platform for free. Rozie owns the
 * author-side API, the two-way binding, the fill math, the range sort, and the
 * overlays. So this spec proves the NATIVE author-side primitives (two-way
 * r-model, $computed fill, scoped #mark/#value slots, $expose handle) produce
 * identical behaviour across all 6 targets.
 *
 * The four demos:
 *   - examples/demos/SliderBehaviorDemo.rozie  — single value, [0,100] step 1.
 *   - examples/demos/SliderRangeDemo.rozie     — dual-thumb, [lo,hi] sorted readout.
 *   - examples/demos/SliderVerticalDemo.rozie  — rotate-90 + aria-orientation.
 *   - examples/demos/SliderMarksDemo.rozie     — marks overlay + #mark + #value slots.
 *
 * Each imports the (Plan 02) `../../packages/ui/slider/src/Slider.rozie`. Until
 * the source + the 6 compiled leaves exist, the per-target HTML is absent, so the
 * `test.fixme` guard SKIPS each cell — the suite stays green-but-skipped while the
 * failing behavioral contract for reqs 2-9 is staged (Nyquist Wave 0).
 *
 * VR DRIVE TECHNIQUE (RESEARCH Pitfall 1 — the single highest-risk item):
 *   - Value commit (req 3): set `.value` to a known fraction + dispatch native
 *     `input`/`change` with `composed: true` (shadow-safe). NEVER a synthetic
 *     pointer drag — it does NOT map clientX→value on a native range input.
 *   - Direction/orientation (req 4, 6): keyboard (always real, always crosses
 *     shadow) — `.focus()` + `keyboard.press('ArrowUp'|'Home'|'End'|'PageUp')`.
 *   - Range (req 5): `.nth(0)` (lo) / `.nth(1)` (hi); drive lo past hi → clamp.
 *   - Assert the COMMITTED value delta (the bound `readout-value`), never a
 *     velocity/momentum snap.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * pixel-baseline snapshots. Like listbox.spec.ts / embla-carousel.spec.ts, this
 * runs locally on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

function builtFor(target: (typeof TARGETS)[number]): boolean {
  return existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
}

// ---------------------------------------------------------------------------
// 1. Single value — drag-commit (set-value + dispatch), keyboard, two-way write.
//    Covers req 2 (two-way single), req 3 (drag commit quantized), req 4
//    (keyboard direction), req 8 (ARIA min/max).
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  const runner = !builtFor(target) || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`slider [${target}]: drag-commit (set-value+dispatch) + keyboard + two-way write round-trip`, async ({
    page,
  }) => {
    await page.goto(`/?example=SliderBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // The CSS locator pierces Lit's open shadow root.
    const input = page.locator('input[type=range]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const readout = page.getByTestId('readout-value');
    // Seeded at 50.
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 15_000,
      })
      .toBe('50');

    // ---- req 8: ARIA / value attrs ----
    await expect(input).toHaveAttribute('min', '0');
    await expect(input).toHaveAttribute('max', '100');

    // ---- req 3: drag commit via set .value + dispatch (NEVER a pointer drag) ----
    // Set to 75% of [0,100] = 75 (step=1 → quantized exactly). Dispatch native
    // input + change with composed:true so the event crosses the Lit shadow.
    await input.evaluate((el: HTMLInputElement) => {
      const min = Number(el.min || 0);
      const max = Number(el.max || 100);
      el.value = String(min + (max - min) * 0.75);
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    // Assert the COMMITTED value delta (the bound readout), not a momentum snap.
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('75');

    // ---- req 4: keyboard direction (ArrowUp / Home / End / PageUp) ----
    await input.focus();
    await page.keyboard.press('Home'); // → min (0)
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('0');

    await page.keyboard.press('ArrowUp'); // → +1 step (1)
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('1');

    await page.keyboard.press('End'); // → max (100)
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('100');

    await page.keyboard.press('Home'); // back to 0 for a clean PageUp delta
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('0');
    await page.keyboard.press('PageUp'); // → +pageStep (a larger jump than Arrow)
    await expect
      .poll(async () => {
        const v = Number((await readout.textContent())?.trim() ?? '0');
        return v > 1; // PageUp moves further than a single ArrowUp
      }, { timeout: 10_000 })
      .toBe(true);

    // ---- req 2: direct model WRITE path reflects into the component ----
    await page.getByTestId('set-value').click();
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('30');
  });
}

// ---------------------------------------------------------------------------
// 2. Range — dual-thumb sorted no-crossover (req 5) + range ARIA (req 8).
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  const runner = !builtFor(target) || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`slider-range [${target}]: dual thumb, drive lo past hi clamps + array stays sorted`, async ({
    page,
  }) => {
    await page.goto(`/?example=SliderRange&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const lo = page.locator('input[type=range]').nth(0);
    const hi = page.locator('input[type=range]').nth(1);
    await expect(lo).toBeVisible({ timeout: 15_000 });
    await expect(hi).toBeVisible({ timeout: 15_000 });

    const readout = page.getByTestId('readout-value');
    // Seeded at [20, 80] (JSON.stringify in the demo).
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 15_000,
      })
      .toBe('[20,80]');

    // ---- req 5: drive lo ABOVE hi → it must clamp at hi, array stays sorted ----
    await lo.evaluate((el: HTMLInputElement) => {
      el.value = '95'; // above hi (80)
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    await expect
      .poll(async () => {
        const arr = JSON.parse((await readout.textContent())?.trim() || '[]');
        // sorted (no crossover): arr[0] <= arr[1], and lo clamped at hi (80).
        return Array.isArray(arr) && arr.length === 2 && arr[0] <= arr[1] && arr[0] === 80;
      }, { timeout: 10_000, intervals: [100, 200, 400, 800] })
      .toBe(true);

    // ---- req 8: range ARIA / value attrs on both inputs ----
    await expect(lo).toHaveAttribute('min', '0');
    await expect(hi).toHaveAttribute('max', '100');
  });
}

// ---------------------------------------------------------------------------
// 3. Vertical — explicit aria-orientation + up=increase (req 6).
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  const runner = !builtFor(target) || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`slider-vertical [${target}]: aria-orientation=vertical present, ArrowUp increases`, async ({
    page,
  }) => {
    await page.goto(`/?example=SliderVertical&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const input = page.locator('input[type=range]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    // ---- req 6: explicit aria-orientation="vertical" (native reports horizontal) ----
    await expect(page.locator('[aria-orientation="vertical"]')).toHaveCount(1);

    const readout = page.getByTestId('readout-value');
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 15_000,
      })
      .toBe('50');

    // up = increase: ArrowUp raises the value.
    await input.focus();
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => {
        const v = Number((await readout.textContent())?.trim() ?? '0');
        return v > 50;
      }, { timeout: 10_000 })
      .toBe(true);
  });
}

// ---------------------------------------------------------------------------
// 4. Marks — one marker per :marks entry + #mark scoped slot + #value bubble (req 7).
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  const runner = !builtFor(target) || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`slider-marks [${target}]: one marker per mark entry, #mark slot renders, #value bubble present`, async ({
    page,
  }) => {
    await page.goto(`/?example=SliderMarks&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const input = page.locator('input[type=range]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    // ---- req 7: one marker per marks entry (3 marks: Low / Mid / High) ----
    // The #mark scoped slot renders a .mark-label per entry.
    await expect
      .poll(async () => page.locator('.mark-label').count(), {
        timeout: 15_000,
      })
      .toBe(3);
    await expect(page.locator('.mark-label').nth(0)).toContainText('Low');
    await expect(page.locator('.mark-label').nth(1)).toContainText('Mid');
    await expect(page.locator('.mark-label').nth(2)).toContainText('High');

    // ---- req 7: #value bubble (showValue) present ----
    await expect(page.locator('.value-bubble')).toHaveCount(1);
  });
}

// ---------------------------------------------------------------------------
// 5. $expose handle — drive a handle verb (set-value button stands in for the
//    consumer hook); the readout reflects it on ref-resolving targets (req 9).
//    The `focus` verb is a DELIBERATE ROZ137 override (documented, accepted).
// ---------------------------------------------------------------------------
for (const target of TARGETS) {
  const runner = !builtFor(target) || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`slider-expose [${target}]: handle-driven value change reflects in the readout`, async ({
    page,
  }) => {
    await page.goto(`/?example=SliderBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const input = page.locator('input[type=range]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const readout = page.getByTestId('readout-value');
    // The demo's set-value button is the consumer hook that drives the bound model
    // (the $expose increment/focus verbs are exercised once the leaves wire them);
    // asserting the readout reflects the driven change proves the ref round-trip.
    await page.getByTestId('set-value').click();
    await expect
      .poll(async () => (await readout.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('30');
  });
}
