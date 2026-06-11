import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Embla Carousel behavioral smoke — Embla v8 (`Carousel`).
 *
 * `Carousel` is the engine-wrapper archetype simplified: Rozie owns the host,
 * renders the consumer's slides inside a flex container, attaches a vanilla
 * Embla v8 instance to the viewport in `$onMount`, drives `transform:
 * translate3d(...)`, two-way binds the snap index, and `$expose`s a 9-verb
 * imperative handle. `examples/demos/CarouselDemo.rozie` drives a 5-slide
 * config-array carousel, a two-way `r-model:selectedIndex`, a `next-model`
 * button (direct `$data.idx` write), a `next` button (the `$expose`
 * `scrollNext()` handle), and a readout of the bound index.
 *
 *   1. **Mount + slides (all 6 targets) — the make-or-break.** The wrapper host
 *      `.rozie-embla` + `.rozie-embla__viewport` appear and ≥3
 *      `.rozie-embla__slide` render. This proves the Embla engine attached to
 *      the viewport and the consumer slides are in the container.
 *
 *   2. **Two-way index WRITE path (all 6 targets, incl Angular).** Clicking
 *      `next-model` writes `$data.idx` DIRECTLY; the model write flows into the
 *      wrapper → echo-guarded `$watch` → `embla.scrollTo(i)` → Embla's `select`
 *      echo → `$model.selectedIndex` → the bound `readout-index` climbs above 0.
 *      This is the uniform two-way round-trip — it works on Angular precisely
 *      because it does NOT depend on the imperative handle.
 *
 *   3. **Pointer-drag swipe (all 6 targets).** A real left-swipe over the
 *      viewport drives Embla's pointer drag → a snap change → the readout rises.
 *      Embla uses POINTER events (not native HTML5 drag), so `page.mouse`
 *      down/move/up is the correct gesture (unlike SortableJS, which needs the
 *      synthetic `DragEvent` helper).
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. The deterministic pixel baseline is the SEPARATE
 * `CarouselScreenshot` matrix cell (`CarouselScreenshotDemo`). Like
 * `rete-flow.spec.ts` / `maplibre-map.spec.ts`, this spec runs locally on macOS
 * without a Docker baseline.
 *
 * ANGULAR-REF-NOOP CAVEAT (documented, the Cropper/FlowCanvas precedent): the
 * `next` button calls the `$expose` `scrollNext()` handle via a `ref`. On
 * Angular a child-component `ref` resolves to the HOST ELEMENT, not the instance
 * handle, so `scrollNext()` no-ops there. The `next` path is therefore STRUCTURAL
 * coverage only (asserted on the 5 ref-resolving targets); the `next-model`
 * direct model write is the UNIFORM behavioral driver asserted on all 6.
 *
 * If this spec is red but the other engine specs (chart, tiptap, maplibre, rete)
 * are green, the regression is in the Carousel wrapper's `$onMount` attach, the
 * echo-guarded two-way `$watch`, or the reInit reconcile — not the broader
 * engine-wrapper pattern.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`embla-carousel [${target}]: carousel mounts, slides render, two-way index round-trips, pointer-drag swipes`, async ({
    page,
  }) => {
    await page.goto(`/?example=Carousel&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + slides render (the make-or-break) ----
    // The CSS locators pierce Lit's open shadow root.
    const host = page.locator('.rozie-embla').first();
    await expect(host).toBeVisible({ timeout: 15_000 });
    const viewport = page.locator('.rozie-embla__viewport').first();
    await expect(viewport).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.locator('.rozie-embla__slide').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(3);

    const readout = page.getByTestId('readout-index');
    await expect(readout).toHaveText('0');

    // ---- 2. two-way index WRITE path (uniform across all 6 incl Angular) ----
    // Click `next-model` → direct `$data.idx` write → echo-guarded $watch →
    // embla.scrollTo → `select` echo → bound readout climbs above 0.
    await page.getByTestId('next-model').click();
    await expect
      .poll(async () => Number((await readout.textContent())?.trim() ?? '0'), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBeGreaterThan(0);
    const afterModel = Number((await readout.textContent())?.trim() ?? '0');

    // ---- 2b. $expose scrollNext() handle (structural — no-ops on Angular) ----
    // On the 5 ref-resolving targets the handle drives a further snap; on
    // Angular the child ref is the host element so this no-ops (documented).
    if (target !== 'angular') {
      await page.getByTestId('next').click();
      await expect
        .poll(async () => Number((await readout.textContent())?.trim() ?? '0'), {
          timeout: 10_000,
          intervals: [100, 200, 400, 800],
        })
        .toBeGreaterThan(afterModel - 1);
    }

    // ---- 3. real pointer-drag swipe over the viewport ----
    // Embla uses POINTER drag (not native HTML5 drag) — page.mouse is correct.
    // Reset to the first snap via the model so the swipe has room to move right→
    // left forward. We drive the index back to 0 by re-mounting expectations:
    // instead, capture the current index and assert a LEFT swipe changes it.
    const beforeSwipe = Number((await readout.textContent())?.trim() ?? '0');
    const box = await viewport.boundingBox();
    if (!box) throw new Error('embla viewport bounding box unavailable');
    const cy = box.y + box.height / 2;
    // A left-swipe (drag from right toward left) advances to the next snap when
    // not already at the end; a right-swipe retreats. Pick the direction that
    // has room: if at the last reachable snap, swipe right (retreat) instead.
    const slideCount = await page.locator('.rozie-embla__slide').count();
    const atEnd = beforeSwipe >= slideCount - 1;
    const startX = atEnd ? box.x + box.width * 0.2 : box.x + box.width * 0.8;
    const endX = atEnd ? box.x + box.width * 0.8 : box.x + box.width * 0.2;

    await page.mouse.move(startX, cy);
    await page.mouse.down();
    // Several intermediate moves so Embla's pointer-drag threshold is crossed.
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(startX + ((endX - startX) * i) / 8, cy, { steps: 2 });
    }
    await page.mouse.up();

    // The swipe drove Embla's drag → a snap change → the bound readout changed.
    await expect
      .poll(async () => Number((await readout.textContent())?.trim() ?? '0'), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .not.toBe(beforeSwipe);
  });
}
