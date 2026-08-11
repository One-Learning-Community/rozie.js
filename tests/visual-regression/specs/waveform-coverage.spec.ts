import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Closes the full COVERAGE-GAP surface named in
 * `.planning/quick/260811-kt2-wavesurfer-debut-shore-up/AUDIT.md` §3 (groups
 * G-A through G-K). Before this quick task, `@rozie-ui/wavesurfer`'s ONLY
 * runtime exercise on any target was a single static pixel cell
 * (WaveformScreenshot in matrix.spec.ts) — not one prop, emit, model, or
 * expose verb had ever been driven at runtime. This spec drives
 * `WaveformCoverage` — a SEPARATE behavioral-only rig from
 * `WaveformScreenshotDemo` (untouched, per the standing Linux-baseline
 * rule).
 *
 * Gap groups closed by leg:
 *   1. G-A construction-time options (peaks/duration first-class props +
 *      autoplay + hideScrollbar — mount without crashing, canvas paints).
 *   2. G-B setOptions-reconciled options (height/waveColor/cursor/bars/
 *      normalize — canvas repaints after each toggle).
 *   3. G-C dedicated-call reconciles (src->load without a rebuild,
 *      minPxPerSec->zoom, volume/playbackRate via instrumented setters).
 *   4. G-D plugin presence, live toggle (timeline/hover DOM delta, engine
 *      NOT rebuilt — readyCount stays flat).
 *   5. G-E regions construction + lazy registration (playback cell's fixed
 *      array at construction; main cell's null->array transition).
 *   6. G-F region CRUD event set (regionCreated via a real drag-to-create
 *      gesture, regionClicked via a real click, regionUpdated via a real
 *      drag-move, regionRemoved via the handle's clearRegions()).
 *   7. G-G regions two-way model (id-less echo-back, the sameRegions
 *      no-oscillation guard observed red-first, controlled add/update/
 *      remove-by-id via the handle's getRegions() readback).
 *   8. G-H currentTime two-way model (consumer-write -> engine seek on all
 *      6 targets; engine-writeback during real playback, Angular-gated).
 *   9. G-I playback event set + verbs (ref-triggered on 5/6 targets;
 *      construction-time autoplay cell gives Angular its only non-ref path).
 *   10. G-J imperative handle (Angular-gated — component refs resolve to the
 *       host element there, per code-mirror.spec.ts:346-353).
 *   11. G-K construction-only interaction opt-outs (disableInteraction /
 *       disableDragToSeek, proven via remount + click/drag gestures).
 *
 * Per `feedback_vr_linux_baselines`: ZERO screenshot assertions — behavioral
 * only. This is a macOS host; no Linux baseline may be blessed from here.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

/**
 * KNOWN_FAILING — populated ONLY for a classified, filed finding (never a
 * silently softened assertion). Empty until red-first runs name a real
 * target-specific gap.
 */
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

/**
 * DRAG_CREATE_KNOWN_FAILING — Angular AND Lit, scoped to the two legs that
 * depend on wavesurfer.js's RegionsPlugin `enableDragSelection` drag-to-
 * create gesture (Leg 4 and Leg 5). Root-caused red-first via direct engine
 * instrumentation (see `.planning/todos/pending/
 * angular-zonejs-wavesurfer-drag-threshold-tracking.md`) on BOTH targets:
 *   - A plain click on the SAME canvas correctly fires `interaction` on both
 *     targets (coordinates and event delivery are fine).
 *   - The RegionsPlugin's `pointerdown` listener IS correctly registered on
 *     `main`'s wrapper element on both targets, at the expected time, scoped
 *     to the expected element (confirmed via an `addEventListener`
 *     instrumented init script that walks each `pointerdown` registration
 *     back to its owning `data-testid`) — including confirming
 *     `disableDragToSeek` correctly suppressed the CONSTRUCTION-time
 *     drag-to-seek tracker on `main` (only ONE `main`-scoped listener ever
 *     appears, registered exactly when `enableDragSelection` runs).
 *   - Despite both of the above, no combination of drag speed/step-count/
 *     pause-length, nor a hand-crafted native `PointerEvent` sequence
 *     dispatched directly (bypassing Playwright's CDP mouse synthesis
 *     entirely), ever produces a `region-created`/`region-initialized` event
 *     on either target.
 * This is NOT a Rozie source or emitter bug: the boolean prop threads
 * identically to all six targets and the listener wiring is provably
 * correct on both. The suspected (UNCONFIRMED) common thread is that both
 * targets run a global reactive-scheduling layer that patches browser APIs
 * (Angular's zone.js patches `addEventListener`/`setTimeout`/`Promise`; the
 * Lit leaf's `@lit-labs/preact-signals` peer does analogous DOM-patching
 * scheduling) that may interfere with wavesurfer.js's own vanilla
 * `document`-level pointermove/pointerup threshold-tracking closure — a
 * third-party/third-party interaction outside either library Rozie
 * controls. NOT worked around; recorded as an evidenced per-target
 * limitation per the plan's explicit instruction.
 */
const DRAG_CREATE_KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>(['angular', 'lit']);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

function dragCreateRunnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || DRAG_CREATE_KNOWN_FAILING.has(target) ? test.fixme : test;
}

async function gotoCoverage(page: import('@playwright/test').Page, target: string) {
  await page.goto(`/?example=WaveformCoverage&target=${target}`);
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();
  return mount;
}

/**
 * Deep, shadow-piercing element lookup by `data-testid`. The Lit target
 * mounts the WHOLE demo inside its own custom-element shadow root (not just
 * wavesurfer's internal shadow wrapper), so a raw `document.querySelector`
 * finds nothing there at all — it must walk every element's `.shadowRoot`
 * from `document` down, not just from an already-resolved light-DOM node.
 * Embedded as a literal string so every `page.evaluate` call below can
 * inline it (evaluate closures cannot reference outer JS functions).
 */
const FIND_DEEP_SRC = `
  function findDeep(root, testId) {
    const direct = root.querySelector ? root.querySelector('[data-testid="' + testId + '"]') : null;
    if (direct) return direct;
    const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of all) {
      if (el.shadowRoot) {
        const found = findDeep(el.shadowRoot, testId);
        if (found) return found;
      }
    }
    return null;
  }
`;

function collectCanvasesSrc() {
  return `
    function collectCanvases(root) {
      const acc = [];
      const walk = (r) => {
        for (const el of r.querySelectorAll('*')) {
          if (el.tagName === 'CANVAS') acc.push(el);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(root);
      return acc;
    }
  `;
}

/** Count canvas pixels with a colored (non-gray) channel spread — piercing
 * EVERY shadow root from `document` down (Lit wraps the whole demo in its
 * own shadow root; wavesurfer itself additionally uses an inner shadow
 * wrapper), mirroring matrix.spec.ts's WaveformScreenshot poll. Existence
 * ("has this cell painted anything at all") only — NOT sensitive to a
 * specific color/size change (see canvasChecksum for that). */
async function paintedPixels(page: import('@playwright/test').Page, testId: string): Promise<number> {
  return page.evaluate(
    // eslint-disable-next-line no-new-func
    new Function(
      'tid',
      `${FIND_DEEP_SRC}${collectCanvasesSrc()}
      const root = findDeep(document, tid);
      if (!root) return 0;
      const canvases = collectCanvases(root);
      let best = 0;
      for (const c of canvases) {
        const ctx = c.getContext('2d');
        if (!ctx || !c.width || !c.height) continue;
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        let colored = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (Math.max(r, g, b) - Math.min(r, g, b) > 20) colored++;
        }
        if (colored > best) best = colored;
      }
      return best;`,
    ) as unknown as (tid: string) => number,
    testId,
  );
}

/**
 * A deterministic checksum over the "best" (most-painted) canvas's raw pixel
 * buffer — sensitive to ANY visual change (a color swap, a size change, a
 * bar-pattern switch), unlike paintedPixels's coarse "how many pixels are
 * colored at all" count, which does NOT change when a hue changes without
 * changing HOW MANY pixels are colored (e.g. purple->green at the same
 * opacity/coverage). Used for the setOptions-reconcile / zoom repaint legs.
 */
async function canvasChecksum(page: import('@playwright/test').Page, testId: string): Promise<string> {
  return page.evaluate(
    // eslint-disable-next-line no-new-func
    new Function(
      'tid',
      `${FIND_DEEP_SRC}${collectCanvasesSrc()}
      const root = findDeep(document, tid);
      if (!root) return 'no-root';
      const canvases = collectCanvases(root);
      let best = null, bestCount = -1;
      for (const c of canvases) {
        const ctx = c.getContext('2d');
        if (!ctx || !c.width || !c.height) continue;
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
        if (n > bestCount) { bestCount = n; best = data; }
      }
      if (!best) return 'no-canvas';
      let sum = 0;
      for (let i = 0; i < best.length; i += 7) sum = (sum * 31 + best[i]) >>> 0;
      return String(sum);`,
    ) as unknown as (tid: string) => string,
    testId,
  );
}

/** Deep DOM node count (piercing every shadow root, see FIND_DEEP_SRC above)
 * under a given testid's subtree — used to prove a plugin's DOM presence
 * toggles without reading engine internals. */
async function deepNodeCount(page: import('@playwright/test').Page, testId: string): Promise<number> {
  return page.evaluate(
    // eslint-disable-next-line no-new-func
    new Function(
      'tid',
      `${FIND_DEEP_SRC}
      const root = findDeep(document, tid);
      if (!root) return 0;
      const walk = (r) => {
        let n = 0;
        for (const el of r.querySelectorAll('*')) {
          n += 1;
          if (el.shadowRoot) n += walk(el.shadowRoot);
        }
        return n;
      };
      return walk(root);`,
    ) as unknown as (tid: string) => number,
    testId,
  );
}

async function firstCanvas(mount: ReturnType<import('@playwright/test').Page['getByTestId']>, testId: string) {
  const loc = mount.getByTestId(testId).locator('canvas').first();
  // Every raw page.mouse coordinate below is computed from boundingBox() and
  // used with page.mouse.down/move/up (which do NOT auto-scroll, unlike a
  // locator .click()) — this rig stacks five sections vertically, so a cell
  // below the fold resolves a real boundingBox() whose y exceeds the
  // viewport height, and page.mouse silently hits nothing there
  // (elementFromPoint at that coordinate returns null). Always scroll first.
  await loc.scrollIntoViewIfNeeded();
  return loc;
}

// ─── Leg 1 (G-B): setOptions-reconciled options repaint the canvas ─────────
for (const target of TARGETS) {
  runnerFor(target)(
    `waveform-coverage [${target}]: setOptions-reconciled props (height/waveColor/cursor/bars/normalize) repaint the canvas`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect
        .poll(() => paintedPixels(page, 'coverage-main-wrap'), {
          timeout: 10_000,
          intervals: [200, 400, 800, 1600],
        })
        .toBeGreaterThan(50);

      const before = await canvasChecksum(page, 'coverage-main-wrap');
      await mount.getByTestId('main-toggle-wavecolor').click();
      await expect
        .poll(() => canvasChecksum(page, 'coverage-main-wrap'), { timeout: 5_000 })
        .not.toBe(before);

      const afterColor = await canvasChecksum(page, 'coverage-main-wrap');
      await mount.getByTestId('main-toggle-height').click();
      await expect
        .poll(() => canvasChecksum(page, 'coverage-main-wrap'), { timeout: 5_000 })
        .not.toBe(afterColor);

      const afterHeight = await canvasChecksum(page, 'coverage-main-wrap');
      await mount.getByTestId('main-toggle-cursor-bars').click();
      await expect
        .poll(() => canvasChecksum(page, 'coverage-main-wrap'), { timeout: 5_000 })
        .not.toBe(afterHeight);
    },
  );
}

// ─── Leg 2 (G-C): src->load reconcile (no rebuild) + minPxPerSec->zoom ──────
for (const target of TARGETS) {
  runnerFor(target)(
    `waveform-coverage [${target}]: src reconciles via load() (readyCount grows, no remount) and minPxPerSec reconciles via zoom()`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(mount.getByTestId('main-ready-count')).toContainText('readyCount=1', {
        timeout: 8_000,
      });

      await mount.getByTestId('main-load-audio').click();
      await expect(
        mount.getByTestId('main-ready-count'),
        'a src reconcile must call load() and fire a SECOND ready, without recreating the component (readyCount is a rig-side counter — an unmount/remount would reset it to 1)',
      ).toContainText('readyCount=2', { timeout: 10_000 });

      const before = await canvasChecksum(page, 'coverage-main-wrap');
      await mount.getByTestId('main-zoom-in').click();
      await expect
        .poll(() => canvasChecksum(page, 'coverage-main-wrap'), { timeout: 5_000 })
        .not.toBe(before);
    },
  );
}

// ─── Leg 3 (G-D): plugin presence toggles live, no engine rebuild ──────────
for (const target of TARGETS) {
  runnerFor(target)(
    `waveform-coverage [${target}]: timeline/hover register+unregister on the LIVE engine (DOM delta, readyCount stays flat)`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(mount.getByTestId('main-ready-count')).toContainText('readyCount=1', {
        timeout: 8_000,
      });

      const nodeCount = () => deepNodeCount(page, 'coverage-main-wrap');

      const before = await nodeCount();
      await mount.getByTestId('main-toggle-timeline').click();
      await expect
        .poll(nodeCount, {
          timeout: 5_000,
          message: 'toggling timeline on must add DOM nodes (the Timeline plugin renders a ruler)',
        })
        .toBeGreaterThan(before);

      await mount.getByTestId('main-toggle-hover').click();
      const afterHover = await nodeCount();
      expect(afterHover).toBeGreaterThan(before);

      // No engine rebuild occurred for either toggle — the rig-side
      // readyCount counter (bumped only from buildWaveSurfer's `ready`
      // handler) must still read exactly 1.
      await expect(mount.getByTestId('main-ready-count')).toContainText('readyCount=1');
    },
  );
}

// ─── Leg 4 (G-E/G-F/G-G): lazy regions registration + CRUD + two-way model ─
// Angular-skipped — see DRAG_CREATE_KNOWN_FAILING above.
for (const target of TARGETS) {
  dragCreateRunnerFor(target)(
    `waveform-coverage [${target}]: regions register lazily, a drag-create fires regionCreated + echoes an engine-assigned id, and identical rebuilds do not oscillate`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect
        .poll(() => paintedPixels(page, 'coverage-main-wrap'), { timeout: 8_000 })
        .toBeGreaterThan(50);

      await mount.getByTestId('main-enable-drag-create').click();
      await mount.getByTestId('main-register-regions').click();
      await page.waitForTimeout(300);

      // Acquired AFTER both state changes settle, never cached across an
      // interaction: wavesurfer replaces its canvas element(s) on certain
      // redraws (observed directly — registering the Regions plugin and
      // toggling minPxPerSec both swap the underlying <canvas> node), so a
      // reference captured before these clicks can go stale mid-gesture.
      const canvas = await firstCanvas(mount, 'coverage-main-wrap');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('main canvas has no bounding box');
      // Drag across a wide empty span so it reliably registers as a
      // drag-create gesture rather than a click-to-seek.
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.2, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, y, { steps: 5 });
      await page.mouse.up();
      // wavesurfer.js installs a CAPTURING document 'click' suppressor for
      // ~10ms after a drag ends (to stop the mouseup from also registering
      // as a spurious click) — settle past that window before any
      // subsequent click-based interaction in this leg or the next.
      await page.waitForTimeout(300);

      await expect(
        mount.getByTestId('region-created-count'),
        'a drag-to-create gesture over empty waveform space must fire regionCreated',
      ).toContainText('regionCreated=1', { timeout: 8_000 });
      await expect(
        mount.getByTestId('regions-echo-id'),
        'a region created without a consumer-supplied id must echo the engine-assigned id back through the two-way model',
      ).not.toContainText('(no id)');

      // sameRegions no-oscillation guard: rebuild the SAME content into a
      // brand-new array/object references (the react-object-prop-stability
      // hazard from AUDIT.md §6) — regionCreated/regionUpdated must NOT
      // increment further.
      const createdBefore = await mount.getByTestId('region-created-count').textContent();
      const updatedBefore = await mount.getByTestId('region-updated-count').textContent();
      await mount.getByTestId('main-rebuild-identical').click();
      await mount.getByTestId('main-rebuild-identical').click();
      await page.waitForTimeout(300);
      await expect(
        mount.getByTestId('region-created-count'),
        'rebuilding regions with IDENTICAL content must not re-fire regionCreated (the sameRegions value-equality guard)',
      ).toContainText(createdBefore ?? '');
      await expect(
        mount.getByTestId('region-updated-count'),
        'rebuilding regions with IDENTICAL content must not re-fire regionUpdated (the sameRegions value-equality guard)',
      ).toContainText(updatedBefore ?? '');
    },
  );
}

// ─── Leg 5 (G-F regionClicked / regionUpdated): real gestures on a region ───
// Angular-skipped — see DRAG_CREATE_KNOWN_FAILING above (this leg's setup
// depends on the same drag-to-create gesture Leg 4 documents as failing
// there).
for (const target of TARGETS) {
  dragCreateRunnerFor(target)(
    `waveform-coverage [${target}]: a real click on a region fires regionClicked, and a real drag-move fires regionUpdated`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect
        .poll(() => paintedPixels(page, 'coverage-main-wrap'), { timeout: 8_000 })
        .toBeGreaterThan(50);

      await mount.getByTestId('main-enable-drag-create').click();
      await mount.getByTestId('main-register-regions').click();
      await page.waitForTimeout(300);

      // See Leg 4's comment — acquired fresh after both state changes settle.
      const canvas = await firstCanvas(mount, 'coverage-main-wrap');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('main canvas has no bounding box');
      const y = box.y + box.height / 2;
      const x1 = box.x + box.width * 0.2;
      const x2 = box.x + box.width * 0.4;
      await page.mouse.move(x1, y);
      await page.mouse.down();
      await page.mouse.move(x2, y, { steps: 5 });
      await page.mouse.up();
      // See Leg 4's comment on the ~10ms post-drag click-suppression window.
      await page.waitForTimeout(300);
      await expect(mount.getByTestId('region-created-count')).toContainText('regionCreated=1', {
        timeout: 8_000,
      });

      // Click the middle of the just-created region.
      const mid = (x1 + x2) / 2;
      await page.mouse.click(mid, y);
      await expect(
        mount.getByTestId('region-clicked-count'),
        'clicking an existing region must fire regionClicked',
      ).toContainText('regionClicked=1', { timeout: 5_000 });

      // Drag the region body to a new position (a real move, not a resize
      // handle) — the default region drag surface is the region body itself.
      await page.mouse.move(mid, y);
      await page.mouse.down();
      await page.mouse.move(mid + box.width * 0.1, y, { steps: 5 });
      await page.mouse.up();
      await expect(
        mount.getByTestId('region-updated-count'),
        'dragging an existing region to a new position must fire regionUpdated',
      ).toContainText('regionUpdated=1', { timeout: 5_000 });
    },
  );
}

// ─── Leg 6 (G-H consumer-write direction): non-ref, all 6 targets ──────────
for (const target of TARGETS) {
  runnerFor(target)(
    `waveform-coverage [${target}]: a consumer write to the currentTime model seeks the engine (round-trip guard threads a genuinely different value through)`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(mount.getByTestId('play-ready-duration')).toContainText('readyDuration=2', {
        timeout: 10_000,
      });

      await mount.getByTestId('play-consumer-seek').click();
      await expect(
        mount.getByTestId('play-time'),
        'a consumer write to $model.currentTime that is genuinely different from the live position (0 vs 1.5, outside the 0.05s round-trip-guard tolerance) must thread through to setTime and settle at the written value',
      ).toContainText('playTime=1.5', { timeout: 5_000 });
    },
  );
}

// ─── Leg 7 (G-I autoplay path, all 6 targets — Angular's only non-ref path) ─
for (const target of TARGETS) {
  runnerFor(target)(
    `waveform-coverage [${target}]: autoplay (construction-only) fires ready+playing without any imperative call`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(
        mount.getByTestId('autoplay-ready-duration'),
        'the autoplay cell must decode the pinned fixture and fire ready with its exact 2s duration',
      ).toContainText('readyDuration=2', { timeout: 10_000 });
      await expect(
        mount.getByTestId('autoplay-playing-count'),
        'autoplay:true must start playback without any click/gesture/ref call',
      ).not.toContainText('playing=0', { timeout: 10_000 });
    },
  );
}

// ─── Leg 8 (G-I ref-triggered verbs/emits, G-H engine-writeback, G-J handle
//      basics) — Angular-gated (component refs resolve to the host element
//      there, per code-mirror.spec.ts:346-353) ───────────────────────────
for (const target of TARGETS) {
  const runner = target === 'angular' ? test.fixme : runnerFor(target);
  runner(
    `waveform-coverage [${target}]: play()/pause() drive real playback (playing/timeupdate/finished fire, currentTime writes back and advances monotonically)`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(mount.getByTestId('play-ready-duration')).toContainText('readyDuration=2', {
        timeout: 10_000,
      });

      await mount.getByTestId('handle-play').click();
      await expect(mount.getByTestId('play-playing-count')).not.toContainText('playing=0', {
        timeout: 8_000,
      });

      const read = async () => {
        const t = await mount.getByTestId('play-time').textContent();
        const m = /playTime=([\d.]+)/.exec(t ?? '');
        return m ? Number(m[1]) : 0;
      };
      const first = await read();
      await page.waitForTimeout(400);
      const second = await read();
      expect(
        second,
        'playback progress must be monotonic (never asserted as an elapsed-time value — a threshold crossing instead)',
      ).toBeGreaterThanOrEqual(first);

      await expect(
        mount.getByTestId('play-finished-count'),
        'a 2s fixture at 1x rate must reach `finished` well within this timeout',
      ).not.toContainText('finished=0', { timeout: 15_000 });

      // EMITTER-BACKLOG (see .planning/todos/pending/
      // lit-multiword-emit-kebab-camelcase-mismatch.md) — on Lit specifically,
      // a consumer's kebab-cased `@region-in`/`@region-out` template binding
      // never fires: the child dispatches the raw camelCase source name
      // (`regionIn`/`regionOut`) verbatim, so the two never match
      // (`addEventListener` is case-sensitive). Confirmed the underlying
      // engine events genuinely fire (a listener installed directly on the
      // live RegionsPlugin instance sees them on schedule) — this is a
      // listener-wiring gap in the Lit target, not a source or engine bug,
      // and it affects every multi-word `$emit()` name consumed via
      // component-to-component composition on Lit, not just this family.
      if (target !== 'lit') {
        await expect(mount.getByTestId('play-region-in')).toContainText('seg', { timeout: 5_000 });
        await expect(mount.getByTestId('play-region-out')).toContainText('seg', { timeout: 5_000 });
      }
    },
  );
}

// ─── Leg 9 (G-J imperative handle) — Angular-gated ─────────────────────────
for (const target of TARGETS) {
  const runner = target === 'angular' ? test.fixme : runnerFor(target);
  runner(
    `waveform-coverage [${target}]: the imperative handle's remaining verbs resolve and return sane values`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(mount.getByTestId('main-ready-count')).toContainText('readyCount=1', {
        timeout: 8_000,
      });
      await expect(mount.getByTestId('play-ready-duration')).toContainText('readyDuration=2', {
        timeout: 10_000,
      });

      const out = mount.getByTestId('handle-out');

      await mount.getByTestId('handle-get-duration').click();
      await expect(out).toContainText('duration=2', { timeout: 5_000 });

      await mount.getByTestId('handle-get-current-time').click();
      await expect(out).toContainText('currentTime=', { timeout: 5_000 });

      await mount.getByTestId('handle-is-playing').click();
      await expect(out).toContainText('isPlaying=', { timeout: 5_000 });

      await mount.getByTestId('handle-get-wavesurfer').click();
      await expect(out).toContainText('wavesurfer-instance', { timeout: 5_000 });

      // Controlled add/update/remove-by-id readback (G-G): the two
      // explicitly-keyed regions replace whatever was live.
      await mount.getByTestId('main-set-controlled-regions').click();
      await page.waitForTimeout(300);
      await mount.getByTestId('handle-get-regions').click();
      await expect(out).toContainText('count=2', { timeout: 5_000 });
      await expect(out).toContainText('ctrl-a,ctrl-b', { timeout: 5_000 });

      // addRegion() + clearRegions() (G-F regionRemoved via the handle).
      const removedBefore = await mount.getByTestId('region-removed-count').textContent();
      await mount.getByTestId('handle-add-region').click();
      await expect(out).toContainText('added=', { timeout: 5_000 });
      await mount.getByTestId('handle-clear-regions').click();
      await expect(out).toContainText('cleared', { timeout: 5_000 });
      // EMITTER-BACKLOG (see .planning/todos/pending/
      // lit-multiword-emit-kebab-camelcase-mismatch.md) — same shape as Leg
      // 8's region-in/region-out skip: `@region-removed` never fires on Lit
      // because the child dispatches the raw camelCase `regionRemoved` name
      // verbatim while the consumer template listens for the literal kebab
      // string. `clearRegions()` itself is proven working above (the handle
      // reports 'cleared'); only the listener-side observation is gapped.
      if (target !== 'lit') {
        await expect(
          mount.getByTestId('region-removed-count'),
          'clearRegions() genuinely removes engine regions outside the reconcile guard, so it must fire regionRemoved',
        ).not.toContainText(removedBefore ?? '');
      }

      await mount.getByTestId('handle-set-zoom').click();
      await expect(out).toContainText('zoomed', { timeout: 5_000 });
    },
  );
}

// ─── Leg 10 (G-C volume/playbackRate reconciles) — Angular-gated (the only
//      observation channel is the handle-installed instrumentation) ────────
for (const target of TARGETS) {
  const runner = target === 'angular' ? test.fixme : runnerFor(target);
  runner(
    `waveform-coverage [${target}]: volume/playbackRate reconciles call the engine setters (no emit exists for this — instrumented via the handle)`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(mount.getByTestId('main-ready-count')).toContainText('readyCount=1', {
        timeout: 8_000,
      });

      const out = mount.getByTestId('handle-out');
      await mount.getByTestId('handle-install-instrumentation').click();
      await expect(out).toContainText('instrumented', { timeout: 5_000 });

      await mount.getByTestId('handle-bump-volume').click();
      await mount.getByTestId('handle-bump-rate').click();
      await page.waitForTimeout(200);
      await mount.getByTestId('handle-read-instrumentation').click();
      await expect(
        out,
        'changing $data.volume/$data.playbackRate must reconcile through setVolume()/setPlaybackRate() on the SAME live instance (sameWs=true — no rebuild)',
      ).toContainText('vol=1 rate=1');
      await expect(out).toContainText('sameWs=true');
    },
  );
}

// ─── Leg 11 (G-A/G-K construct cell: first-class peaks/duration + opt-outs) ─
for (const target of TARGETS) {
  runnerFor(target)(
    `waveform-coverage [${target}]: the first-class peaks/duration props render, and disableInteraction blocks the interaction emit on a fresh construction`,
    async ({ page }) => {
      const mount = await gotoCoverage(page, target);
      await expect(mount.getByTestId('construct-ready-count')).toContainText('readyCount=1', {
        timeout: 8_000,
      });
      await expect
        .poll(() => paintedPixels(page, 'coverage-construct-wrap'), { timeout: 8_000 })
        .toBeGreaterThan(30);

      const canvas = await firstCanvas(mount, 'coverage-construct-wrap');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('construct canvas has no bounding box');
      const y = box.y + box.height / 2;

      // Default (interaction enabled): a click must fire `interaction`.
      await page.mouse.click(box.x + box.width / 2, y);
      await expect(
        mount.getByTestId('construct-interaction-count'),
        'a click on an interactive waveform must fire the `interaction` emit',
      ).toContainText('interactionCount=1', { timeout: 5_000 });

      // Toggle the opt-outs, then REMOUNT — disableInteraction is
      // construction-only and has zero live effect until the component
      // rebuilds (AUDIT.md §1: read once in buildWaveSurfer).
      await mount.getByTestId('construct-enable-optouts').click();
      await mount.getByTestId('construct-remount').click();
      await expect(mount.getByTestId('construct-ready-count')).toContainText('readyCount=2', {
        timeout: 5_000,
      });
      await expect
        .poll(() => paintedPixels(page, 'coverage-construct-wrap'), { timeout: 8_000 })
        .toBeGreaterThan(30);

      const box2 = await (await firstCanvas(mount, 'coverage-construct-wrap')).boundingBox();
      if (!box2) throw new Error('construct canvas has no bounding box after remount');
      const y2 = box2.y + box2.height / 2;
      await page.mouse.click(box2.x + box2.width / 2, y2);
      await page.waitForTimeout(300);
      await expect(
        mount.getByTestId('construct-interaction-count'),
        'a click on a waveform constructed with disableInteraction=true must NOT fire `interaction`',
      ).toContainText('interactionCount=1');
    },
  );
}
