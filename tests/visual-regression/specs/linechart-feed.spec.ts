import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * LineChartDemo live-feed behavioral gate — debug session
 * `linechart-watch-recreate`, round 3 / step C.
 *
 * This is the CI-gated successor to `scripts/probe-linechart-feed.mjs`, the
 * throwaway probe written during the debug session. Where
 * `chart-recreation.spec.ts` gates Bug B (+0 `new Chart()` per data tick),
 * this spec gates the THREE companion fixes around the live-feed path —
 * fixes that are otherwise only protected by per-target emit-shape snapshots
 * (which silently re-bless on `vitest -u`):
 *
 *   - R1f (React stale closure, commit 7317038) — `pushPoint` does
 *     `$data.points = [...$data.points.slice(-19), next]`. React must lower a
 *     self-referential `$data` write to the functional updater
 *     `setPoints(prev => ...)`. The pre-fix `setPoints(f(points))` form
 *     captured `points` stale, so the `setInterval`-pinned `pushPoint`
 *     rebuilt the SAME 7-seed array forever — the React feed froze at 8
 *     points. GATE: the React point count grows PAST 8.
 *
 *   - R1g (Svelte `r-model` on a checkbox, commit a272a57) — the
 *     `<input type="checkbox" r-model="$data.liveFeed">` must emit
 *     `bind:checked` (not `bind:value`). Pre-fix the box rendered unchecked
 *     and toggling never wrote back. GATE: the "Live feed" checkbox renders
 *     CHECKED at mount (liveFeed defaults true) and toggling it stops the feed.
 *
 *   - R1h ($watch immediate-by-default, commit a847926) — LineChartDemo's
 *     `$watch(() => $data.liveFeed, ...)` must fire on registration to START
 *     the interval (liveFeed defaults true). Vue's `watch` was lazy and
 *     Svelte's `$effect` was skip-initial-gated; both now fire immediately.
 *     GATE: the feed AUTO-STARTS on Vue and Svelte (count climbs with no
 *     interaction).
 *
 * `chart-recreation.spec.ts` and `line-chart.spec.ts` already cover engine
 * mount + canvas paint + the +0-recreation invariant; this spec deliberately
 * does NOT duplicate those — it only asserts the feed-COUNT and checkbox
 * behaviors that those two specs leave ungated.
 *
 * Per `feedback_vr_linux_baselines`: behavioral assertions (`toBeGreaterThan`
 * on a count delta, `isChecked()`) — NO `toHaveScreenshot`. Runs locally on
 * macOS without Docker baseline regen.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

/**
 * KNOWN_FAILING is empty as of 2026-05-19 — the `linechart-watch-recreate`
 * debug session closed R1f / R1g / R1h on all relevant targets. Retained so a
 * future regression can temporarily re-fixme a cell without altering the
 * spec's test-generation shape.
 */
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

/**
 * Targets whose live feed must AUTO-START (R1h $watch immediate-fire). Vue's
 * `watch` and Svelte's `$effect` were the two previously-lazy primitives — if
 * the feed climbs on these two with zero interaction, the immediate-fire
 * contract holds. The other four were already immediate.
 */
const AUTO_START_TARGETS: readonly Target[] = ['vue', 'svelte'];

/**
 * Read the "Count" stat. LineChartDemo renders it as the first <dd> inside
 * `<dl class="stats">` (`<dt>Count</dt><dd>{{ points.length }}</dd>`).
 *
 * The selector is a SUBSTRING class match `dl[class*="stats"]` rather than a
 * literal `.stats`: the React target applies CSS Modules to consumer styles,
 * renaming the consumer-authored `stats` class to a scoped name like
 * `_stats_a78f3_66` (the original class name survives as a substring per
 * Vite/PostCSS-Modules' `localIdentName` default). Vue / Svelte / Angular /
 * Solid / Lit keep the `stats` literal — the substring matcher subsumes both.
 * (`line-chart.spec.ts` uses the identical technique for `rozie-linechart`.)
 *
 * A Playwright locator also auto-pierces shadow roots, so this works for the
 * Lit target whose whole demo renders inside the producer's shadow DOM
 * (`document.body.innerText` would not reach it).
 */
async function readCount(page: Page): Promise<number | null> {
  const dd = page.locator('dl[class*="stats"] dd').first();
  if ((await dd.count()) === 0) return null;
  const txt = (await dd.innerText({ timeout: 3_000 })).trim();
  const n = Number.parseInt(txt, 10);
  return Number.isNaN(n) ? null : n;
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(`linechart-feed [${target}]: live-feed count grows + checkbox state`, async ({
    page,
  }) => {
    await page.goto(`/?example=LineChart&target=${target}`);

    // Chart must mount before the feed path is meaningful.
    await page.waitForSelector('canvas', { timeout: 15_000 });
    // Settle Chart.js's first-paint RAF and any mount-phase effects.
    await page.waitForTimeout(600);

    const count0 = await readCount(page);
    expect(
      count0,
      `${target}: could not read the "Count" stat — LineChartDemo stats markup changed?`,
    ).not.toBeNull();
    // The demo seeds 7 points in <data>.
    expect(count0!).toBeGreaterThanOrEqual(7);

    // R1h ($watch immediate-fire) — for Vue + Svelte the feed must auto-start
    // with NO interaction: liveFeed defaults true, and `$watch(() =>
    // $data.liveFeed, ...)` must fire on registration to spin up the
    // setInterval. Wait > 2 ticks (0.8s each) and assert the count climbed.
    if (AUTO_START_TARGETS.includes(target)) {
      await expect
        .poll(() => readCount(page), {
          timeout: 8_000,
          intervals: [400, 800, 800, 1600],
          message:
            `${target}: live feed did not auto-start (R1h $watch immediate-fire ` +
            `regression) — the "Count" stat must climb above ${count0} with no ` +
            `user interaction`,
        })
        .toBeGreaterThan(count0!);
    }

    // R1f (React stale closure) — the feed point count must grow PAST 8. The
    // pre-fix bug froze React at 8 forever (seed array of 7 + one fresh point,
    // rebuilt from the same stale closure capture every tick). We click "Push
    // point" enough times to push the count well past 8; on a correct
    // functional-updater lowering each click appends exactly one point.
    const pushBtn = page.getByRole('button', { name: 'Push point' });
    await expect(pushBtn).toBeVisible({ timeout: 5_000 });
    const beforePushes = (await readCount(page)) ?? count0!;
    for (let i = 0; i < 5; i++) {
      await pushBtn.click({ timeout: 5_000 });
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(300);
    const afterPushes = await readCount(page);
    expect(afterPushes).not.toBeNull();
    // Each "Push point" appended a point — the count must have grown, and in
    // particular must clear 8 (the pre-fix React freeze ceiling).
    expect(
      afterPushes!,
      `${target}: feed point count did not grow past 8 (R1f stale-closure ` +
        `regression) — 5 "Push point" clicks from ${beforePushes} produced ${afterPushes}`,
    ).toBeGreaterThan(8);
    expect(afterPushes!).toBeGreaterThan(beforePushes);

    // R1g (Svelte checkbox r-model) — the "Live feed" checkbox must render
    // CHECKED at mount (liveFeed defaults true) and toggling it must write
    // back to $data.liveFeed (which stops the feed). Pre-fix Svelte emitted
    // `bind:value` on the checkbox: it rendered unchecked and the toggle was
    // dead. A Playwright locator pierces shadow roots, so the checkbox is
    // reachable on every target including Lit.
    const checkbox = page.locator('input[type="checkbox"]').first();
    const checkboxCount = await checkbox.count();
    if (checkboxCount === 0) {
      // No checkbox located at all — the contract is gated by the per-target
      // emitTemplateAttribute suites for that target.
      test.info().annotations.push({
        type: 'note',
        description: `${target}: no checkbox located — r-model gated by unit suite`,
      });
      return;
    }

    const checkedAtMount = await checkbox.isChecked({ timeout: 3_000 });
    expect(
      checkedAtMount,
      `${target}: "Live feed" checkbox is not checked at mount (R1g r-model ` +
        `regression) — liveFeed defaults true so the box must render checked`,
    ).toBe(true);

    // Toggling the checkbox must flip its state — the two-way binding writes
    // back to $data.liveFeed.
    await checkbox.click({ timeout: 3_000 });
    await page.waitForTimeout(150);
    const afterToggle = await checkbox.isChecked();
    expect(
      afterToggle,
      `${target}: toggling the "Live feed" checkbox did not flip its state ` +
        `(R1g r-model regression) — the bind: directive must write back`,
    ).toBe(false);

    // With the feed toggled OFF, the count must STOP climbing. Read twice
    // across > 2 tick intervals; a correct stop yields an unchanged count.
    const stoppedAt = (await readCount(page)) ?? afterPushes!;
    await page.waitForTimeout(2_100);
    const stillStopped = await readCount(page);
    expect(stillStopped).not.toBeNull();
    expect(
      stillStopped!,
      `${target}: feed kept ticking after the checkbox was toggled off ` +
        `(R1g write-back regression) — count went ${stoppedAt} -> ${stillStopped}`,
    ).toBe(stoppedAt);
  });
}
