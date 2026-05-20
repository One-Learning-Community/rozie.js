import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Bug B regression gate — Chart.js instance must NOT be recreated on data ticks.
 *
 * This is the CI-gated successor to `scripts/probe-chart-recreation.mjs`, the
 * throwaway probe written during the `linechart-watch-recreate` debug session.
 * `line-chart.spec.ts` is a STRUCTURAL smoke (canvas mounts + paints); this
 * spec is a BEHAVIORAL gate (the watcher reconciles into the EXISTING chart
 * instead of destroying + rebuilding it).
 *
 * ## The bug
 *
 * `examples/LineChart.rozie` creates its Chart.js instance ONCE in `$onMount`
 * and reconciles subsequent data changes via
 * `$watch(() => $props.data, ...) → instance.data = v; instance.update()`.
 *
 * Rozie's hook dependency analysis attributed *transitive* reactive reads —
 * reads occurring inside helper functions a hook merely CALLS — to the caller
 * hook. `$onMount` and the `type` `$watch` both call `buildConfig()`, which
 * reads `$props.data`. On the auto-tracking targets (React/Svelte/Solid —
 * and latently Angular/Lit) this turned a run-once mount hook and a
 * getter-scoped watcher into reactive effects that re-fired `new Chart()` on
 * every data tick: a full chart "regrow" animation per 0.8s feed tick.
 *
 * Round 1 (commits 43cdf9a / e57df14 / cf4f518 …) closed it for
 * React/Svelte/Solid. Round 2 closed the same latent over-tracking for
 * Angular + Lit by wrapping the `$watch` callback in `untracked(...)` so
 * only the getter's reads define what re-runs the watcher.
 *
 * ## The instrumentation
 *
 * Every `new Chart(canvas, config)` call invokes
 * `HTMLCanvasElement.prototype.getContext` exactly once. We monkey-patch that
 * prototype method via `page.addInitScript` BEFORE any app code runs, so a
 * monotonic counter on `window.__getContextCount` tracks every Chart.js
 * instantiation. After mount, clicking "Push point" appends one data point —
 * a correct target shows getContext delta 0 (chart created once, never
 * again); a broken target shows delta > 0 (the mount hook / type watcher
 * re-fired `new Chart()` because a transitive reactive read leaked into its
 * dep set).
 *
 * Per `feedback_vr_linux_baselines`: behavioral assertion (`toBe(0)` on a
 * counter delta) — NO `toHaveScreenshot`. Runs locally on macOS without
 * Docker baseline regen.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

/**
 * KNOWN_FAILING is empty as of 2026-05-19 — the `linechart-watch-recreate`
 * debug session closed Bug B on all six targets (round 1: React/Svelte/Solid;
 * round 2: Angular/Lit `$watch` callback `untracked`-wrap). The set is
 * retained so a future regression can temporarily re-fixme a cell without
 * altering the spec's test-generation shape.
 */
const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

// How many "Push point" clicks to exercise. Each click appends one data
// point; the watcher must reconcile it into the existing instance.
const CLICKS = 6;

// Instrument getContext BEFORE any app code runs. Each `new Chart()` calls
// `HTMLCanvasElement.prototype.getContext` exactly once.
const INIT_SCRIPT = `
  (() => {
    window.__getContextCount = 0;
    const proto = HTMLCanvasElement.prototype;
    const orig = proto.getContext;
    proto.getContext = function (...args) {
      window.__getContextCount += 1;
      return orig.apply(this, args);
    };
  })();
`;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`chart-recreation [${target}]: +0 new Chart() per data tick`, async ({
    page,
  }) => {
    await page.addInitScript(INIT_SCRIPT);
    await page.goto(`/?example=LineChart&target=${target}`);

    // Wait for the chart canvas to appear and for the first `new Chart()` to
    // have run (getContext count >= 1).
    await page.waitForSelector('canvas', { timeout: 15_000 });
    await page.waitForFunction(() => (window.__getContextCount ?? 0) >= 1, {
      timeout: 15_000,
    });
    // Settle: let Chart.js's first-paint RAF + any mount-phase effects flush.
    await page.waitForTimeout(600);

    const baseline = await page.evaluate(
      () => window.__getContextCount ?? 0,
    );

    // The chart was created exactly once at mount.
    expect(baseline, 'chart should instantiate at least once at mount').toBeGreaterThanOrEqual(1);

    // Click "Push point" CLICKS times — each appends one data point, which
    // LineChart's `$watch(() => $props.data, ...)` reconciles into the
    // EXISTING chart instance via `instance.data = v; instance.update()`.
    const pushBtn = page.getByRole('button', { name: 'Push point' });
    await expect(pushBtn).toBeVisible({ timeout: 5_000 });
    for (let i = 0; i < CLICKS; i++) {
      await pushBtn.click({ timeout: 5_000 });
      await page.waitForTimeout(150);
    }
    // Allow any async re-render / effect flush after the final click.
    await page.waitForTimeout(400);

    const afterClicks = await page.evaluate(
      () => window.__getContextCount ?? 0,
    );

    // THE GATE: zero additional `new Chart()` calls across CLICKS data
    // changes. delta > 0 means the mount hook or the `type` watcher re-fired
    // `new Chart()` because a transitive reactive read leaked into its dep
    // set (Bug B regression).
    expect(
      afterClicks - baseline,
      `${target}: Chart.js instance recreated on data tick (Bug B regression) — ` +
        `expected +0 new Chart() across ${CLICKS} "Push point" clicks, got +${afterClicks - baseline}`,
    ).toBe(0);

    // Canvas node identity — confirm no component remount. A correct run
    // keeps a single stable <canvas> node. (Lit cells render the canvas
    // inside the producer's shadow DOM; Playwright pierces shadow roots, but
    // a `querySelectorAll('canvas')` on the light DOM can legitimately read
    // 0 for the shadow case — so this is an upper-bound guard, not a floor.)
    const canvasCount = await page.evaluate(
      () => document.querySelectorAll('canvas').length,
    );
    expect(
      canvasCount,
      'no extra <canvas> nodes — the component must not remount',
    ).toBeLessThanOrEqual(1);
  });
}
