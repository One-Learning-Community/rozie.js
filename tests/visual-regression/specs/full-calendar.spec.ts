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
 * KNOWN_FAILING is empty as of 2026-05-19. The earlier 4-cell fixme list was
 * progressively closed:
 *
 *   - vue / solid / svelte / angular: closed in Phase 07.7 (commit 67b0918,
 *     6ecb6f0) once `$slots.event` lowering landed for the JSX-emitting
 *     targets and the slot-runtime check was added for Svelte / Angular.
 *   - react: closed by `ca9d339` (2026-05-18) — useRef-stable portal-slot
 *     renderers + BlockStatement hoist + tryWrapEscapingConstUseMemo +
 *     watched-prop ref indirection + flushSync at portal mount.
 *   - lit: closed by the fullcalendar-lit-watch-property fix (2026-05-19) —
 *     $watch on $props.X now lowers to `updated(changedProperties)` instead
 *     of `effect()`, which never re-fired because @lit-labs/preact-signals'
 *     `effect()` doesn't subscribe to Lit @property reads.
 *
 * The set is retained (vs. removed entirely) so a future regression can
 * temporarily re-fixme a cell without altering the spec's test-generation
 * shape.
 */
const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

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
    // assertion finds zero matches, the portal-slot bridge is broken: either
    // consumer's `.event=${fn}` isn't being assigned, or producer's
    // `eventContent: (arg) => { $portals.event(node, { arg }) }` never fires.
    //
    // Substring-match `[class*="fc-event-title"]` instead of literal
    // `.fc-event-title` because the React target applies CSS Modules to
    // consumer styles, renaming the consumer-authored `fc-event-title`
    // class to a scoped name like `_fc-event-title_nzury_51` (the original
    // class name is preserved as a substring per Vite/PostCSS-Modules'
    // localIdentName default). Vue / Svelte / Angular / Solid keep the
    // class literal (their scoping uses attribute selectors), so the
    // substring matcher subsumes both forms cross-target. The literal
    // class name was the original assertion before the React target's
    // CSS-Modules-by-default landed.
    const titles = mount.locator('[class*="fc-event-title"]');
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
