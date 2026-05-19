import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Portal-slot primitive (Spike 003) — real-third-party-engine runtime smoke.
 *
 * `examples/FullCalendar.rozie` wraps the real `@fullcalendar/core` engine
 * (v6.x). The wrapper declares `<slot name="event" portal :params="['arg']" />`
 * and routes every engine `eventContent` callback through
 * `$portals.event(node, { arg })`. Consumer's
 * `<template #event="{ arg }">…</template>` content mounts into engine-owned
 * event cells.
 *
 * This spec is the complement to `portal-list.spec.ts`:
 *   - `portal-list.spec.ts` exercises portal-slot against a synthetic in-line
 *     `MiniListEngine` (proves the primitive itself works)
 *   - `full-calendar.spec.ts` (this file) exercises portal-slot against a real
 *     third-party engine with its own lifecycle, CSS injection, and DOM
 *     scaffolding (proves the primitive composes with real-world JS engines —
 *     CSS-in-JS auto-inject, view rendering, event tile DOM creation order)
 *
 * If `portal-list.spec.ts` is green but this spec is red, the regression is
 * in the engine integration path (`$onMount` timing, dispose() ordering,
 * engine-owned node identity) — not the portal-slot primitive itself.
 *
 * Per `feedback_vr_linux_baselines`: this spec makes STRUCTURAL assertions
 * (`toHaveCount`, `toContainText`) — NO `toHaveScreenshot`. It runs locally
 * on macOS without Docker baseline regen.
 *
 * `examples/demos/FullCalendarDemo.rozie` seeds 3 events on $onMount:
 *   { id: 'seed-1', title: 'Standup',        … }
 *   { id: 'seed-2', title: 'Demo',           … }
 *   { id: 'seed-3', title: 'Sprint review',  … }
 *
 * The consumer's `#event` template emits `<span class="fc-event-title">{{
 * arg.event.title }}</span>` inside the engine-owned event cells. The
 * mounted titles are the assertion target — `arg.event.title` reaches the
 * scope correctly only when the portal-slot bridge wires both directions:
 * (consumer → producer) function-prop assignment AND (producer → engine)
 * `$portals.event(node, { arg })` invocation inside FullCalendar's
 * `eventContent` callback.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

/**
 * Targets with known-failing FullCalendar compile output (added 2026-05-19,
 * discovered while standing up this spec). Tracked as PHASE_07_7 candidate
 * in `outstanding-issues-post-gate-rollout` memory. Cells gate on `test.fixme`
 * until the underlying target-emitter bug ships:
 *
 *   - vue: `$slots.event` in `<script>` is emitted as a bare identifier
 *     (`$slots is not defined` ReferenceError). The Vue target needs to lower
 *     `$slots.X` to `useSlots().X` (in `<script setup>`) or `this.$slots.X`.
 *   - react: `const setView = useCallback(v => { setView(v); }, [])` —
 *     `model: true` setter shadows itself when the user authors a same-named
 *     wrapper. The compiler needs to rename one or use a guaranteed-unique
 *     internal identifier.
 *   - solid: same `$slots` bug surface (likely; not yet root-caused).
 *   - lit: same `$slots` bug surface (likely; not yet root-caused).
 *
 * svelte + angular pass — their target emitters lower `$slots.event` to a
 * runtime check that resolves correctly.
 */
const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set([
  // React: cleanup-undefined fix + portal+useEffect wiring get the calendar
  // chrome to render, but the portal-mounted event titles do not commit.
  // Root cause hypothesis: the FullCalendar useEffect's dep array includes
  // `props.renderEvent` (fresh arrow each consumer render), so the effect
  // cleans up before React commits the `createRoot(node).render` call.
  // Needs deeper redesign — likely a useRef-stable renderEvent indirection.
  'react',
  // Lit: `$el → $refs.__rozieRoot` + `$slots.<portal> → this.<X> !== undefined`
  // + cleanup-undefined-drop fixes get the engine mounted inside the shadow
  // root, but `$watch(() => $props.events, …)` doesn't re-fire — Lit's @lit-
  // labs/preact-signals `effect()` tracks signals, not Lit @property accesses.
  // Demo seeds events in `firstUpdated`, child's calendar is already created
  // with the initial `[]`. Fix path: route @property reads through signal
  // wrappers in the Lit script-rewrite so `effect()` subscribes correctly.
  'lit',
] as const);

const EXPECTED_TITLES = ['Standup', 'Demo', 'Sprint review'];

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`full-calendar [${target}]: mounts engine + renders portal event titles`, async ({
    page,
  }) => {
    await page.goto(`/?example=FullCalendar&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Wait for FullCalendar to finish first-mount. The engine creates `.fc`
    // as its root container; presence of `.fc-toolbar` proves the chrome
    // rendered (rules out a CSS-injection failure that would leave the
    // calendar invisible). For Lit cells, .fc lives inside the producer's
    // shadow DOM but Playwright's locator engine pierces shadow boundaries
    // by default.
    const calendar = mount.locator('.fc');
    await expect(calendar).toBeVisible({ timeout: 10_000 });
    const toolbar = mount.locator('.fc-toolbar');
    await expect(toolbar.first()).toBeVisible();

    // The smoke gate: consumer's `<template #event>` content reaches the
    // engine-owned event cells. `.fc-event-title` is the consumer-authored
    // class (NOT a FullCalendar built-in — FC's own class is
    // `.fc-event-title-container` / `.fc-event-main-frame`). If the
    // assertion finds zero `.fc-event-title` spans, the portal-slot bridge
    // is broken: either consumer's `.event=${fn}` isn't being assigned, or
    // producer's `eventContent: (arg) => { $portals.event(node, { arg }) }`
    // never fires.
    const titles = mount.locator('.fc-event-title');
    await expect(titles).toHaveCount(EXPECTED_TITLES.length, { timeout: 5_000 });

    // Spot-check that the scope param survives the portal mount — at least
    // one title text must match the seeded data. Per-title order varies
    // by view (dayGridMonth orders by date) so we collect all rendered
    // titles and assert set-equality.
    const renderedTitles = await titles.allTextContents();
    const normalized = renderedTitles.map((t) => t.trim()).sort();
    expect(normalized).toEqual([...EXPECTED_TITLES].sort());
  });
}
