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
 * translate3d(...)`, two-way binds the snap index, and `$expose`s a 14-verb
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

    // ---- 3. real pointer-drag scrolls the track (the drag IS wired to Embla) ----
    // Embla uses POINTER/mouse drag (not native HTML5 drag) — page.mouse is correct.
    //
    // We assert the LOAD-BEARING, deterministic behavior: while the pointer is held
    // and dragged, the `.rozie-embla__container` transform FOLLOWS the pointer (the
    // track moves). We deliberately do NOT assert the post-release snap INDEX: the
    // snap-vs-snap-back decision is Embla's internal momentum math, computed from
    // release VELOCITY — which is identical vanilla engine code on all 6 targets but
    // is sensitive to synthetic-event timing (a Playwright drag can land either side
    // of the force threshold per run/target/OS). The cross-framework wrapper's job is
    // to attach Embla to the viewport and let pointer drag drive the track; that the
    // track moves under a held drag proves it — on all 6, INCLUDING through Lit's open
    // shadow boundary (verified: pointerDown/Up fire and the container translates
    // mid-drag on every target). The two-way index round-trip (assertion 2) already
    // proves snap-index propagation; the momentum landing is not the wrapper's contract.
    const container = page.locator('.rozie-embla__container').first();
    const tx = async () => {
      const m = await container.evaluate(
        (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
      );
      return m;
    };
    const box = await viewport.boundingBox();
    if (!box) throw new Error('embla viewport bounding box unavailable');
    const cy = box.y + box.height / 2;
    const startX = box.x + box.width * 0.85;
    const endX = box.x + box.width * 0.15;
    const txBefore = await tx();

    await page.mouse.move(startX, cy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX + ((endX - startX) * i) / 10, cy, { steps: 3 });
    }
    // MID-drag (pointer still held): the track has followed the pointer left.
    const txMid = await tx();
    await page.mouse.up();

    // The held drag translated the container left by a meaningful distance.
    expect(Math.abs(txMid - txBefore)).toBeGreaterThan(20);
  });
}

/**
 * Index-survives-reInit smoke (260802-tmo, D1) — pins the fix for the audit's
 * HIGH defect: the carousel used to teleport back to `startIndex` on every
 * reInit, so any runtime option flip silently threw the user back to slide 0.
 * `CarouselDemo.rozie`'s `:loop` is now bound to `$data.loopOn` (a WATCHED
 * option, `Carousel.rozie:404-408`), with a `toggle-loop` button driving it.
 *
 * Drives the index to 2 via the UNIFORM two-way path (`next-model`, not the
 * `next` handle — the handle no-ops on Angular per ANGULAR-REF-NOOP above),
 * flips `loopOn`, and asserts the position survived on BOTH halves: the bound
 * readout AND the container transform. Asserting both makes the failure
 * unambiguous — today the engine snaps the position back to `startIndex: 0`
 * (a full reInit reset), so the transform assertion is the load-bearing RED;
 * depending on echo ordering the readout may or may not follow.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`embla-carousel-reinit [${target}]: the selected index survives a runtime option change`, async ({
    page,
  }) => {
    await page.goto(`/?example=Carousel&target=${target}`);
    await expect(page.locator('.rozie-embla__viewport').first()).toBeVisible({
      timeout: 15_000,
    });

    // ---- drive the index to 2 via the uniform two-way path ----
    const readout = page.getByTestId('readout-index');
    await page.getByTestId('next-model').click();
    await page.getByTestId('next-model').click();
    await expect
      .poll(async () => Number((await readout.textContent())?.trim() ?? '0'), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe(2);

    // ---- flip a WATCHED option (loop) → triggers Carousel.rozie's
    //      option-signature $watch → embla.reInit(...) ----
    await page.getByTestId('toggle-loop').click();

    // ---- assert BOTH halves: the model and the engine can disagree ----
    const container = page.locator('.rozie-embla__container').first();
    const tx = async () => {
      const m = await container.evaluate(
        (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
      );
      return m;
    };
    await expect
      .poll(async () => Number((await readout.textContent())?.trim() ?? '0'), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe(2);
    // The transform is the load-bearing assertion: a reset-to-startIndex reInit
    // snaps the container back to ~0 translation (startIndex defaults to 0).
    await expect
      .poll(async () => Math.abs(await tx()), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBeGreaterThan(20);
  });
}

/**
 * Built-in navigation behavioral smoke (dots + arrows + thumbnails) — guards two
 * bugs that the deterministic `CarouselNavScreenshot` pixel cell alone can't:
 *
 *   1. **Snap count reflects every slide (all 6, esp. Lit).** The dots are one
 *      `<button>` per Embla scroll snap (`r-for` over `$data.snaps`). On Lit the
 *      trailing empty declarative-mode `<slot/>` used to render as a real 0-width
 *      shadow-DOM child of `.rozie-embla__container`; Embla counted it as a
 *      phantom 5th slide and collapsed `scrollSnapList()` to ONE snap — so Lit
 *      showed a single dot with the next-arrow disabled while the five hostless
 *      targets showed four. The fix pins Embla's `slides` option to
 *      `.rozie-embla__slide`, so all six now measure four snaps → four dots.
 *
 *   2. **Thumb click scrolls without throwing (Embla-8 `clickAllowed` removed).**
 *      `selectThumb` used to guard on `emblaThumbs.clickAllowed()`, which Embla 8
 *      dropped from its public API — every thumb tap threw
 *      `TypeError: …clickAllowed is not a function`. Clicking a thumb must now
 *      scroll the main track and raise NO page error.
 *
 * Structural/behavioral only (no `toHaveScreenshot`) so it runs on macOS without a
 * Docker baseline, same as the sibling spec above.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`embla-carousel-nav [${target}]: dots reflect all snaps, thumb click scrolls (no clickAllowed throw)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto(`/?example=CarouselNavScreenshot&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // ---- 1. one dot per snap: four slides → four dots on EVERY target ----
    // (the Lit phantom-<slot> bug measured a single snap → a single dot).
    await expect
      .poll(async () => page.locator('.rozie-embla__dot').count(), {
        timeout: 15_000,
      })
      .toBe(4);
    // >1 snap ⇒ the next arrow is enabled (the bug disabled it on Lit).
    await expect(
      page.locator('.rozie-embla__arrow--next').first(),
    ).toBeEnabled();

    // ---- 2. thumb click scrolls the MAIN track, throwing no clickAllowed error ----
    const container = page.locator('.rozie-embla__container').first();
    const trackX = async () =>
      container.evaluate(
        (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
      );
    const txBefore = await trackX();
    // Thumb 2 (0-indexed) → scrollTo(2): the track translates left (m41 drops).
    await page.locator('.rozie-embla__thumb').nth(2).click();
    await expect
      .poll(trackX, { timeout: 10_000, intervals: [100, 200, 400, 800] })
      .toBeLessThan(txBefore - 20);

    // selectThumb ran without hitting the removed Embla-8 clickAllowed() method.
    expect(pageErrors.join('\n')).toBe('');
  });
}

/**
 * Declarative (mode b) slide coverage (260802-tmo, Task 2) — mode b is a
 * documented headline capability (embla.md "two slide-source modes",
 * embla-comparison.md's "Config-array AND declarative slides ✅" row).
 * `CarouselDeclarativeDemo.rozie` passes NO `:slides` prop; four
 * `.rozie-embla__slide` children are dropped directly into the default slot.
 *
 * Runs UNGATED on all six targets (quick 260807-cor, D4 — the
 * `$slotted.<name>` sigil closed the Lit-only gap this title used to route
 * around via `DECLARATIVE_KNOWN_FAILING` / `test.fixme`). Assertion 4 below
 * is the D4-specific reactivity proof: appending a light-DOM slide AFTER
 * mount grows the rendered dot count, which requires Lit's assigned-elements
 * signal to be BOTH seeded at mount (assertion 1-3 depend on this) AND live
 * post-mount (this is the part native `querySelectorAll` could never give
 * Lit — see the reInit-backstop `$watch` in Carousel.rozie).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`embla-carousel-declarative [${target}]: default-slot slide DOM mounts and drives the engine`, async ({
    page,
  }) => {
    await page.goto(`/?example=CarouselDeclarative&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    // ---- 1. the four declarative-mode slide children mounted ----
    await expect
      .poll(async () => page.locator('.rozie-embla__slide').count(), {
        timeout: 15_000,
      })
      .toBe(4);

    // ---- 2. next-model drives the engine (the light-DOM slides were
    //      actually measured, not just rendered) ----
    const readout = page.getByTestId('readout-index');
    await page.getByTestId('next-model').click();
    await expect
      .poll(async () => Number((await readout.textContent())?.trim() ?? '0'), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBeGreaterThan(0);

    // ---- 3. the container transform moved off origin ----
    const container = page.locator('.rozie-embla__container').first();
    const tx = async () => {
      const m = await container.evaluate(
        (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
      );
      return m;
    };
    await expect
      .poll(async () => Math.abs(await tx()), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBeGreaterThan(20);

    // ---- 4. post-mount reactivity (quick 260807-cor D4): appending a
    //      light-DOM slide AFTER mount grows the rendered dot count. Append
    //      as a SIBLING of an EXISTING `.rozie-embla__slide`
    //      (`existingSlide.parentElement`) rather than querying a container
    //      class directly — `.parentElement` is unambiguous regardless of
    //      per-target DOM shape (a plain descendant of `.rozie-embla__
    //      container` on the five hostless targets; the LIGHT-DOM host
    //      custom element itself on Lit, since a slotted node's `.parentNode`
    //      is always its original light-DOM parent, never the shadow `<slot>`
    //      it is rendered through). This is exactly what the
    //      `$slotted.default` reInit-backstop watch in Carousel.rozie exists
    //      to observe on Lit — Embla's own native watchSlides
    //      MutationObserver is shadow-container-scoped and never fires for
    //      light-DOM mutations.
    //
    //      `deepQuerySelector` is load-bearing on Lit specifically:
    //      `CarouselDeclarativeDemo` is ITSELF a Lit custom element (its own
    //      shadow root), so `.rozie-embla__slide` sits TWO shadow boundaries
    //      below `document` there (`rozie-carousel-declarative-demo`'s shadow
    //      root → `<rozie-carousel>` → its light-DOM children) — a plain
    //      `document.querySelector` never finds it and the append silently
    //      no-ops (confirmed live: `document.querySelector` returns null,
    //      `host?.appendChild` short-circuits on the null). Playwright's OWN
    //      locator engine pierces shadow roots automatically (used for every
    //      other assertion in this title); raw `page.evaluate` browser JS
    //      does not, so this test needs its own shadow-piercing walk.
    const dotsBefore = await page.locator('.rozie-embla__dot').count();
    await page.evaluate(() => {
      function deepQuerySelector(root: Document | ShadowRoot, selector: string): Element | null {
        const found = root.querySelector(selector);
        if (found) return found;
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const inner = deepQuerySelector(el.shadowRoot, selector);
            if (inner) return inner;
          }
        }
        return null;
      }
      const existingSlide = deepQuerySelector(document, '.rozie-embla__slide');
      const host = existingSlide?.parentElement;
      const slide = document.createElement('div');
      slide.className = 'rozie-embla__slide';
      // Inline sizing — a dynamically `createElement`d node carries NO
      // `data-rozie-s-<hash>` scope attribute, so the demo's own SCOPED
      // `.rozie-embla__slide { flex: 0 0 100%; … }` / `.slide-body { … }`
      // rules (both scoped to the demo's own template) never reach it.
      // Inline styles sidestep that entirely and keep this assertion's pass
      // condition about Embla's slide COUNT, not an incidental CSS-scoping
      // interaction.
      slide.style.flex = '0 0 100%';
      slide.style.minWidth = '0';
      const body = document.createElement('div');
      body.className = 'slide-body';
      body.style.flex = '0 0 100%';
      body.style.minWidth = '0';
      body.style.height = '120px';
      body.textContent = 'Epsilon';
      slide.appendChild(body);
      host?.appendChild(slide);
    });
    await expect
      .poll(async () => page.locator('.rozie-embla__dot').count(), {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBeGreaterThan(dotsBefore);
  });
}
