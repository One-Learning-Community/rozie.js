import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * FullCalendar expanded-surface behavioral smoke (Phase 27 Plan 04, D-03).
 *
 * `examples/demos/FullCalendarBehaviorDemo.rozie` consumes the moved
 * `packages/ui/fullcalendar/src/FullCalendar.rozie` wrapper and exercises the
 * surface the 7-prop/3-event screenshot demo (FullCalendarDemo) does NOT:
 *
 *   - NEW runtime-updatable props — `nowIndicator` + `weekends` toggled live.
 *     Flipping each runs the wrapper's
 *     `$watch(() => $props.X) → instance.setOption('X', v)` reconciler on the
 *     LIVE calendar (no remount). The proof is engine-observable: toggling
 *     `weekends` off removes the Sat/Sun columns from the dayGrid (`.fc-day-sat`
 *     / `.fc-day-sun` disappear); toggling `nowIndicator` on is reflected in the
 *     demo's bound state pane.
 *   - NEW events — `select` (REQ-27-3 { start,end,startStr,endStr,allDay }),
 *     `eventResize` ({ event,startDelta,endDelta }), and `datesSet`
 *     ({ start,end,view }). `datesSet` fires on EVERY navigation, so it is the
 *     target-agnostic proof of view-advance: clicking the engine's own
 *     `.fc-next-button` advances the range → fires datesSet → the demo's
 *     state pane (`[data-testid="state-last-event"]`) reads `datesSet`, and the
 *     toolbar title text changes.
 *   - The `$expose` HANDLE — the demo's `data-testid="handle-next"` /
 *     `handle-get-api` buttons call `$refs.cal.next()` / `getApi()` via the
 *     framework-native component ref. getApi() returns the raw Calendar whose
 *     `view.title` is reflected into `[data-testid="state-api-title"]`.
 *
 * WHY BEHAVIORAL-ONLY (no pixel screenshot assertion): per
 * `feedback_vr_linux_baselines`,
 * a structural-only spec runs locally on macOS without any Docker baseline
 * regen. The pixel matrix (FullCalendarDemo → FullCalendar cell) is the
 * baseline-gated screenshot surface; this spec asserts engine REACTIONS via
 * structural selectors + the demo's bound state pane.
 *
 * The existing 'FullCalendar' matrix cell (FullCalendarDemo.rozie) stays
 * byte-untouched: this demo is a SEPARATE example key (FullCalendarBehavior)
 * and is deliberately NOT in matrix.spec.ts EXAMPLES.
 *
 * If this spec is red while the 'full-calendar' wrapper structural cells are
 * green, the regression is in the EXPANDED surface wiring (the new props'
 * setOption reconcilers, the new event emits, or the $expose handle) — NOT the
 * portal-slot engine-mount path covered by full-calendar.spec.ts.
 *
 * For Lit cells the `.fc` engine DOM lives in the producer's shadow DOM, but
 * Playwright's CSS locators pierce shadow boundaries by default.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

for (const target of TARGETS) {
  // Build-availability gate — when the per-target VR sub-build did not produce
  // `dist/<target>/`, register the cell as `test.fixme` (known-pending) rather
  // than erroring (copied from full-calendar.spec.ts / leaflet-map.spec.ts).
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`full-calendar-behavior [${target}]: new props + events + $expose handle`, async ({
    page,
  }) => {
    // A clean integration emits zero uncaught errors. (We do not gate on
    // console.error — FullCalendar v6 logs benign deprecation notices on some
    // setOption paths; pageerror is the hard signal a handler threw.)
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(`/?example=FullCalendarBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // MOUNT — wait for FullCalendar first-mount. `.fc` is the engine root and
    // `.fc-toolbar` proves the chrome rendered (rules out CSS-injection
    // failure). The default headerToolbar has `prev,next today` left + `title`
    // center, so the next button + title both exist.
    const calendar = mount.locator('.fc');
    await expect(calendar).toBeVisible({ timeout: 10_000 });
    const toolbarTitle = mount.locator('.fc-toolbar-title').first();
    await expect(toolbarTitle).toBeVisible({ timeout: 10_000 });

    // ---- NEW EVENT (datesSet) + VIEW ADVANCE via the engine `next` button ----
    // datesSet fires on the initial mount, so the state pane may already read
    // 'datesSet'; capture the CURRENT toolbar title, click the engine's own
    // `.fc-next-button`, and assert (a) the title text changed — the range
    // advanced — and (b) the demo captured a datesSet payload reflecting the
    // new view type. This is the target-AGNOSTIC view-advance proof.
    const titleBefore = (await toolbarTitle.textContent())?.trim() ?? '';
    const nextBtn = mount.locator('.fc-next-button');
    await expect(nextBtn).toBeVisible({ timeout: 10_000 });
    await nextBtn.click();

    await expect(toolbarTitle).not.toHaveText(titleBefore, { timeout: 10_000 });
    const lastEvent = mount.getByTestId('state-last-event');
    await expect(lastEvent).toHaveText('datesSet', { timeout: 10_000 });
    // datesSet payload carries the REQ-27-3 `view` key — the demo renders it
    // into the detail cell; the active dayGridMonth view name is the shape proof.
    await expect(mount.getByTestId('state-last-detail')).toContainText(
      'dayGridMonth',
      { timeout: 10_000 },
    );

    // ---- $expose HANDLE — getApi().view.title via the framework-native ref ----
    // Click the demo's `data-testid="handle-get-api"` button → it calls
    // `$refs.cal.getApi()` and reflects `view.title` into the state pane. On
    // every target where the ref resolves to the handle the title is non-empty
    // and equals the engine toolbar title (the handle round-tripped to the live
    // Calendar). The demo optional-chains the call so it never throws.
    await page.getByTestId('handle-get-api').click();
    const apiTitle = mount.getByTestId('state-api-title');
    await expect(apiTitle).not.toHaveText('(none)', { timeout: 10_000 });
    const apiTitleText = (await apiTitle.textContent())?.trim() ?? '';
    const toolbarTitleText = (await toolbarTitle.textContent())?.trim() ?? '';
    expect(
      apiTitleText,
      'getApi().view.title should equal the live toolbar title',
    ).toBe(toolbarTitleText);

    // ---- $expose HANDLE — next() advances the range a second time ----
    // The demo's `data-testid="handle-next"` button calls `$refs.cal.next()`
    // (and refreshes apiTitle). The handle next() fires datesSet again → the
    // captured event stays 'datesSet' and the toolbar title advances past the
    // engine-button title above.
    const titleBeforeHandle = (await toolbarTitle.textContent())?.trim() ?? '';
    await page.getByTestId('handle-next').click();
    await expect(toolbarTitle).not.toHaveText(titleBeforeHandle, {
      timeout: 10_000,
    });
    await expect(lastEvent).toHaveText('datesSet', { timeout: 10_000 });

    // ---- NEW runtime-updatable prop (weekends) — live setOption reconcile ----
    // Sat/Sun columns are present while weekends is true. Toggle weekends OFF →
    // the wrapper's `$watch(() => $props.weekends) → setOption('weekends', v)`
    // reconciler removes the weekend columns WITHOUT remount.
    const weekendCols = mount.locator('.fc-day-sat, .fc-day-sun');
    await expect(weekendCols.first()).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('toggle-weekends').click();
    await expect(mount.getByTestId('state-weekends')).toHaveText('false', {
      timeout: 10_000,
    });
    await expect(weekendCols).toHaveCount(0, { timeout: 10_000 });

    // ---- NEW runtime-updatable prop (nowIndicator) — bound-state reflect ----
    // Toggle nowIndicator ON → the bound state pane reflects it (the reconciler
    // ran `setOption('nowIndicator', true)`; the now-indicator line only paints
    // in time-grid views, so the bound-state cell is the stable cross-view
    // proof the live setOption path fired without remount).
    await page.getByTestId('toggle-now-indicator').click();
    await expect(mount.getByTestId('state-now-indicator')).toHaveText('true', {
      timeout: 10_000,
    });

    // No uncaught runtime errors across all interactions.
    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual(
      [],
    );
  });
}
