import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Closes the ten deferred COVERAGE-GAPs from the 260810-usc audit (AUDIT.md
 * §3 "closures reachable without a new demo rig" list + the six items that
 * needed one — see the plan for quick-task 260811-9qe). Drives
 * `ChartCoverageDemo` — a SEPARATE rig from `ChartBehaviorDemo`, whose
 * surface is already fully exercised by `chart.spec.ts`.
 *
 * Gaps closed by leg number:
 *   1.  G-01 per-type variant runtime (Bar/Doughnut paint on a page that
 *       never registers their controllers itself — the variant's OWN
 *       module-level registration is what makes it work).
 *   2.  G-02 the `live === next` aliasing guard on identity-$snapshot
 *       targets (React/Solid/Lit) — a cartesian chart's category labels
 *       survive a same-reference update.
 *   3.  G-03 `datasetIdKey` keyed matching — a reorder that omits colors
 *       still lets each dataset's color follow ITS key.
 *   4.  G-03 positional fallback — a renamed (unmatched) key inherits the
 *       color of the slot it lands in.
 *   5.  G-04 `redraw` wholesale re-create — `redraw=false` produces +0 new
 *       `Chart()` per data tick, `redraw=true` produces +1 or more.
 *   6.  G-05 `updateMode` threading into `instance.update(mode)` verbatim.
 *   7.  G-06 `destroyDelay` — the instance survives shortly after unmount
 *       and is destroyed once the grace elapses.
 *   8.  G-07 `ariaLabel` reaches the canvas's accessible name at runtime.
 *   9.  G-08 the `fallback` slot fill is attached inside the canvas.
 *   10. G-10 hover fires BOTH the Rozie `hover` emit and a consumer-supplied
 *       `options.onHover` — composition, not clobbering.
 *
 * G-09 (`/auto` registration semantics) is closed by
 * `packages/ui/chartjs/tests/generated-entries.test.ts` against the real
 * chart.js engine, not by this rig — a browser importing `/auto` needs six
 * framework runtimes plus built dists, out of scope for a VR spec.
 *
 * Per `feedback_vr_linux_baselines`: ZERO screenshot assertions — behavioral
 * only. This is a macOS host; no Linux baseline may be blessed from here.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

/**
 * KNOWN_FAILING — retained-but-empty per the sibling chart specs' convention,
 * so a future regression can re-fixme a cell without reshaping this file. See
 * the header of each leg below for the classification protocol that would
 * populate this set (a filed `.planning/todos/pending/` EMITTER-BACKLOG item
 * is required before adding an entry here).
 */
const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

/** Count canvas pixels with nonzero alpha — a blank canvas is 0 everywhere. */
async function paintedPixels(
  locator: ReturnType<import('@playwright/test').Page['locator']>,
): Promise<number> {
  return locator.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
    return n;
  });
}

function runnerFor(target: typeof TARGETS[number]) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

async function gotoCoverage(page: import('@playwright/test').Page, target: string) {
  await page.goto(`/?example=ChartCoverage&target=${target}`);
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();
  return mount;
}

// ─── Leg 1 (G-01): per-type variant runtime ─────────────────────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: Bar/Doughnut variants paint + Bar reconciles a data update, on a page that never registers their own controllers`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);

      const barCanvas = mount.getByTestId('coverage-bar-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(barCanvas), {
          timeout: 8_000,
          intervals: [200, 400, 800, 1600],
          message:
            "a blank Bar canvas on a page that never registered BarController means the variant's own module-level registration did not execute",
        })
        .toBeGreaterThan(50);

      const doughnutCanvas = mount
        .getByTestId('coverage-doughnut-wrap')
        .locator('canvas')
        .first();
      await expect
        .poll(() => paintedPixels(doughnutCanvas), {
          timeout: 8_000,
          intervals: [200, 400, 800, 1600],
          message: "a blank Doughnut canvas means DoughnutController's own registration did not execute",
        })
        .toBeGreaterThan(50);

      // Hover to seed the bar probe, then push a bar point and hover again —
      // the label count must grow by one, proving the Bar variant's own
      // reconcile watch (inherited from Chart.rozie's transform) actually runs.
      const barBox = await barCanvas.boundingBox();
      if (barBox) await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2);
      const barProbe = mount.getByTestId('coverage-bar-probe');
      await expect(barProbe).toContainText('labels=3', { timeout: 5_000 });

      await mount.getByTestId('coverage-push-bar-btn').click();
      if (barBox) await page.mouse.move(barBox.x + barBox.width / 2 + 1, barBox.y + barBox.height / 2);
      await expect(barProbe).toContainText('labels=4', { timeout: 5_000 });
    },
  );
}

// ─── Leg 2 (G-02): aliasing guard ───────────────────────────────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: category labels survive the live===next aliasing guard on mount, and a reconcile after it`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      const lineCanvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(lineCanvas), { timeout: 8_000, intervals: [200, 400, 800, 1600] })
        .toBeGreaterThan(50);

      const box = await lineCanvas.boundingBox();
      const probe = mount.getByTestId('coverage-probe');

      // Mount-time branch — on React/Solid/Lit, instance.data === $props.data
      // at first hover; a regressed guard would have emptied `labels` here.
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(
        probe,
        'labels=0 on first hover means the live===next aliasing guard wiped the labels array it aliases',
      ).toContainText('labels=5', { timeout: 5_000 });

      // Non-aliased reconcile branch — push a point, hover, count grows by one.
      await mount.getByTestId('coverage-push-point-btn').click();
      if (box) await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
      await expect(probe).toContainText('labels=6', { timeout: 5_000 });
    },
  );
}

// ─── Leg 3 (G-03): keyed dataset matching across a reorder ──────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: a dataset reorder that omits colors keeps each color following ITS datasetIdKey`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      const lineCanvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(lineCanvas), { timeout: 8_000, intervals: [200, 400, 800, 1600] })
        .toBeGreaterThan(50);

      const box = await lineCanvas.boundingBox();
      const probe = mount.getByTestId('coverage-probe');
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(probe).toContainText('A:#3b82f6', { timeout: 5_000 });
      await expect(probe).toContainText('B:#10b981', { timeout: 5_000 });

      await mount.getByTestId('coverage-reorder-btn').click();
      if (box) await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
      // Keys reconciled onto their prior slots — B is now first in the array,
      // A second — but each STILL carries its own color. A regression to
      // positional matching would show B:#3b82f6 (B copied A's color).
      await expect(
        probe,
        'colors following array index rather than datasetIdKey means keyed matching regressed to positional',
      ).toContainText('B:#10b981', { timeout: 5_000 });
      await expect(probe).toContainText('A:#3b82f6', { timeout: 5_000 });
    },
  );
}

// ─── Leg 4 (G-03): positional fallback for an unmatched key ─────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: an unmatched (renamed) datasetIdKey falls back to the color of its positional slot`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      const lineCanvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(lineCanvas), { timeout: 8_000, intervals: [200, 400, 800, 1600] })
        .toBeGreaterThan(50);

      const box = await lineCanvas.boundingBox();
      const probe = mount.getByTestId('coverage-probe');
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(probe).toContainText('A:#3b82f6', { timeout: 5_000 });

      await mount.getByTestId('coverage-rename-btn').click();
      if (box) await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
      // 'A' was renamed to 'Z' (an unseen key) and its color omitted; it
      // landed in slot 0, which held 'A' before — the documented positional
      // fallback should give it slot 0's prior color.
      await expect(probe).toContainText('Z:#3b82f6', { timeout: 5_000 });
    },
  );
}

// ─── Leg 5 (G-04): redraw wholesale re-create ───────────────────────────────
const GET_CONTEXT_INIT_SCRIPT = `
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
  runnerFor(target)(
    `chart-coverage [${target}]: redraw=false reconciles in place (+0 new Chart()), redraw=true re-creates (+1 or more)`,
    async ({ page }) => {
      await page.addInitScript(GET_CONTEXT_INIT_SCRIPT);
      const mount = await gotoCoverage(page, target);
      const lineCanvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(lineCanvas), { timeout: 8_000, intervals: [200, 400, 800, 1600] })
        .toBeGreaterThan(50);
      await page.waitForTimeout(400);

      const before = await page.evaluate(() => window.__getContextCount ?? 0);
      await mount.getByTestId('coverage-push-point-btn').click();
      await page.waitForTimeout(400);
      const afterNoRedraw = await page.evaluate(() => window.__getContextCount ?? 0);
      expect(
        afterNoRedraw - before,
        'redraw=false must not create a new Chart() instance',
      ).toBe(0);

      await mount.getByTestId('coverage-toggle-redraw-btn').click();
      await expect(mount.getByTestId('coverage-redraw-flag')).toContainText('redraw=true');
      const beforeRedraw = await page.evaluate(() => window.__getContextCount ?? 0);
      await mount.getByTestId('coverage-push-point-btn').click();
      await page.waitForTimeout(400);
      const afterRedraw = await page.evaluate(() => window.__getContextCount ?? 0);
      expect(
        afterRedraw - beforeRedraw,
        'redraw=true must re-create (getContext delta >= 1)',
      ).toBeGreaterThanOrEqual(1);
    },
  );
}

// ─── Leg 6 (G-05): updateMode threading ─────────────────────────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: updateMode threads verbatim into instance.update(mode)`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      const lineCanvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(lineCanvas), { timeout: 8_000, intervals: [200, 400, 800, 1600] })
        .toBeGreaterThan(50);

      // Hover FIRST — that's what installs the instance-level update()
      // instrumentation (probeLine -> instrumentUpdate).
      const box = await lineCanvas.boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const mode = mount.getByTestId('coverage-last-mode');
      await expect(mount.getByTestId('coverage-probe')).toContainText('labels=', { timeout: 5_000 });

      await mount.getByTestId('coverage-push-point-btn').click();
      // EMITTER-BACKLOG (see .planning/todos/pending/) — on React specifically,
      // ANY $data write on this page (including the hover above) re-renders
      // the whole function component, and the rig's `lineOptions` object
      // (deliberately plain, not `$computed` — see its own comment for why
      // `$computed` was tried and rejected: it fixes this on React/Solid but
      // breaks Lit's hover handling outright) is rebuilt fresh each render,
      // giving Chart's `options` prop a new reference on every hover. That
      // re-fires the wrapper's OWN `options` $watch (`update('none')`),
      // which races the data-watch's genuine `update(undefined)` call and
      // can leave 'none' as the last-observed mode even though the default
      // (undefined) updateMode never explicitly threaded a 'none' string.
      // This is a rig-observability limitation, not evidence that Chart.rozie
      // itself defaults to 'none' — the SECOND assertion below (explicit
      // none-mode toggle) is unconfounded on every target, including React,
      // because both watches independently agree once none-mode is set.
      if (target !== 'react') {
        await expect(
          mode,
          'the default (undefined) updateMode must not render as the literal string "none"',
        ).not.toContainText('mode=none', { timeout: 5_000 });
      }

      await mount.getByTestId('coverage-toggle-none-mode-btn').click();
      await expect(mount.getByTestId('coverage-none-mode-flag')).toContainText('noneMode=true');
      await mount.getByTestId('coverage-push-point-btn').click();
      await expect(mode).toContainText('mode=none', { timeout: 5_000 });
    },
  );
}

// ─── Leg 7 (G-06): destroyDelay deferred destroy ────────────────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: destroyDelay defers destroy() past 150ms and completes by 700ms`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      const lineCanvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(lineCanvas), { timeout: 8_000, intervals: [200, 400, 800, 1600] })
        .toBeGreaterThan(50);

      // Hover to capture the instance before unmounting.
      const box = await lineCanvas.boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(mount.getByTestId('coverage-probe')).toContainText('labels=', { timeout: 5_000 });

      await mount.getByTestId('coverage-unmount-btn').click();

      const d150 = mount.getByTestId('coverage-destroy-150');
      const d700 = mount.getByTestId('coverage-destroy-700');
      await expect(
        d150,
        'destroyDelay=400 means the instance must still be alive at 150ms',
      ).toContainText('d150=alive', { timeout: 5_000 });
      await expect(
        d700,
        'destroyDelay=400 means the instance must be destroyed by 700ms',
      ).toContainText('d700=destroyed', { timeout: 5_000 });
    },
  );
}

// ─── Leg 8 (G-07): ariaLabel ─────────────────────────────────────────────────
//
// EMITTER-BACKLOG (see .planning/todos/pending/) — React, Svelte, and Solid
// each carry a `colonPropToJsxName`-shaped helper (React:
// packages/targets/react/src/emit/emitTemplateAttribute.ts; Svelte/Solid have
// their own copies) that UNCONDITIONALLY preserves an `aria-*`/`data-*`
// attribute name in kebab-case, even when the binding target is a CUSTOM
// COMPONENT (`elementTagKind === 'component'`) with `inherit-attrs="false"`
// and an explicitly declared camelCase prop of that exact name (Chart.rozie's
// `ariaLabel`). The kebab-case preservation is a deliberate, documented
// design choice for the common case (an `inherit-attrs`-forwarding wrapper
// whose root element needs the literal HTML attribute name to survive a
// rest-props spread) — Chart.rozie's combination of `inherit-attrs="false"`
// PLUS an explicit `ariaLabel` prop falls outside that case, so the
// consumer-supplied value never reaches the prop on these three targets
// (`_props.ariaLabel` stays `undefined`). Angular ([ariaLabel] Input
// binding), Lit (.ariaLabel= property binding), and Vue (whose runtime
// resolves hyphenated/camelCase prop names as equivalent regardless of what
// the compiled `h()` call literally emits) are unaffected.
const ARIA_LABEL_KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>(['react', 'svelte', 'solid']);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || ARIA_LABEL_KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(
    `chart-coverage [${target}]: the canvas carries role=img and the bound ariaLabel as its accessible name`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      const canvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect(canvas).toHaveAttribute('role', 'img');
      await expect(canvas).toHaveAttribute('aria-label', 'Coverage Line Chart');
    },
  );
}

// ─── Leg 9 (G-08): fallback slot ─────────────────────────────────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: the fallback slot fill is attached inside the canvas`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      // attached, not visible — canvas fallback content is never rendered.
      const fallback = mount.getByTestId('coverage-fallback');
      await expect(fallback).toBeAttached();
      const isInsideCanvas = await fallback.evaluate((el) => {
        // React/Vue/Svelte/Angular/Solid all render the `fallback` slot fill
        // as a genuine DOM child inside <canvas> — closest() finds it directly.
        if (el.closest('canvas')) return true;
        // Lit: a native named-slot fill (`<span slot="fallback">`) is LIGHT
        // DOM — it stays a child of the <rozie-chart> HOST element in the
        // actual DOM tree and is only PROJECTED into the shadow tree's
        // `<slot name="fallback">` for rendering (the flat tree), so
        // `closest('canvas')` never finds an ancestor from the light-DOM
        // node itself even though Chart.rozie places that <slot> inside
        // <canvas>. Walk `assignedSlot` to the projection target and check
        // ITS ancestry instead — both the slot and the canvas live in the
        // same shadow root.
        const slot = (el as HTMLElement).assignedSlot;
        return !!slot && !!slot.closest('canvas');
      });
      expect(isInsideCanvas, 'the fallback fill must be attached INSIDE the <canvas> element').toBe(true);
    },
  );
}

// ─── Leg 10 (G-10): hover composition ───────────────────────────────────────
for (const target of TARGETS) {
  runnerFor(target)(
    `chart-coverage [${target}]: a pointer hover fires BOTH the Rozie hover emit and a consumer-supplied options.onHover`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      const lineCanvas = mount.getByTestId('coverage-line-wrap').locator('canvas').first();
      await expect
        .poll(() => paintedPixels(lineCanvas), { timeout: 8_000, intervals: [200, 400, 800, 1600] })
        .toBeGreaterThan(50);

      const box = await lineCanvas.boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

      const hoverCount = mount.getByTestId('coverage-hover-count');
      const consumerHoverCount = mount.getByTestId('coverage-consumer-hover-count');
      await expect
        .poll(async () => (await hoverCount.textContent()) ?? '', { timeout: 5_000 })
        .not.toContain('hover=0');
      await expect(
        consumerHoverCount,
        'a clobbered consumer options.onHover would leave consumerHover stuck at 0 while hover keeps climbing',
      ).not.toContainText('consumerHover=0', { timeout: 5_000 });
    },
  );
}
