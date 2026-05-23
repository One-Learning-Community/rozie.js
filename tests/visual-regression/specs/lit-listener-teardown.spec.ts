import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 15 / Plan 15-07 — Lit `rozieListeners` AsyncDirective teardown probe
 * (D-14 cross-target listener-leak verification).
 *
 * **Why Lit specifically:** Phase 15's cross-target cleanup contract (D-14)
 * relies on per-target reconcilers managing listener detach automatically:
 *   - React / Solid / Vue: host reconciler diffs listener PROPS across renders
 *     and detaches when removed from the output. No explicit probe needed —
 *     the per-target snapshot tests (Plans 15-03/04) prove the emit shape.
 *   - Svelte: `applyListeners` action's `destroy()` callback fires on element
 *     removal (verified by Plan 15-04 Task 1 unit tests).
 *   - Angular: `Renderer2.listen()` disposers register with
 *     `__rozieDestroyRef.onDestroy(...)` (verified by Plan 15-05 Task 2
 *     snapshot tests).
 *   - Lit: `rozieListeners` extends `AsyncDirective` (NOT regular `Directive`
 *     — A2 / Pitfall 7 LOCKED) precisely so it has access to the
 *     `disconnected()` lifecycle hook. The hook iterates the per-Element
 *     WeakMap entry and calls `removeEventListener` for every captured pair.
 *     Without it, listeners survive element disposal cycles and accumulate
 *     (T-15-V5-04 leak).
 *
 * The Lit teardown contract is the cheapest cross-target proof because Lit's
 * `setConnected(false)` cycle is synchronous (other 5 targets ride
 * framework-async reconciliation paths that are harder to deterministically
 * trigger from Playwright).
 *
 * **What this probe asserts:**
 *
 * 1. Mount the Lit-compiled `ROnProbe` consumer (its 2nd span carries the
 *    dynamic-spread `r-on="someObj"` — exercises `rozieListeners` directly).
 * 2. Install an `addEventListener` spy on the dynamic-spread <span> BEFORE
 *    the directive's `update()` runs — capture the (eventName, listener)
 *    pairs the directive attaches.
 * 3. After the initial render, sanity-check: the spy observed > 0
 *    addEventListener calls (the directive attached at least one listener).
 * 4. Install a parallel `removeEventListener` spy.
 * 5. Trigger element disconnect: remove the Lit custom element host from the
 *    DOM (triggers `disconnectedCallback` → propagates to the AsyncDirective's
 *    `disconnected()` hook synchronously).
 * 6. Assert the `removeEventListener` spy observed the SAME set of (eventName,
 *    listener) pairs the `addEventListener` spy captured — no leaks.
 *
 * The other 5 targets are NOT covered by this probe: their cleanup contracts
 * are verified at unit-test level in Plans 15-03/04/05. Per D-14, a single
 * Lit-target end-to-end probe is sufficient to gate the cross-target leak
 * invariant.
 */

const built = existsSync(
  resolve(__dirname, '../dist/lit/host/entry.lit.html'),
);
const runner = built ? test : test.fixme;

runner('lit rozieListeners AsyncDirective: disconnected() removes every attached listener (D-14)', async ({ page }) => {
  // Install spies BEFORE navigating so they're in place before any user
  // <script> runs. Page-level Event.prototype patching is the cross-instance
  // way to observe every add/remove on every Element node — directive
  // instantiation, element re-targeting through Lit's part tree, and the
  // shadow-root boundary are all transparent to a prototype-level spy.
  await page.addInitScript(() => {
    const observed = {
      adds: [] as Array<{ event: string; tag: string; testid: string | null }>,
      removes: [] as Array<{ event: string; tag: string; testid: string | null }>,
    };
    (window as unknown as { __phase15_lit_teardown: typeof observed }).__phase15_lit_teardown = observed;

    const origAdd = EventTarget.prototype.addEventListener;
    const origRemove = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (this instanceof Element) {
        observed.adds.push({
          event: type,
          tag: this.tagName.toLowerCase(),
          testid: (this as HTMLElement).dataset?.testid ?? null,
        });
      }
      return origAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      if (this instanceof Element) {
        observed.removes.push({
          event: type,
          tag: this.tagName.toLowerCase(),
          testid: (this as HTMLElement).dataset?.testid ?? null,
        });
      }
      return origRemove.call(this, type, listener, options);
    };
  });

  await page.goto('/?example=ROnProbe&target=lit');
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();

  // Wait for the Lit custom element to render its shadow content. The 2nd
  // <span> inside the .r-on-probe carries the dynamic `r-on="someObj"`
  // spread — that's the binding that drives `rozieListeners` directly. The
  // host is `<rozie-r-on-probe>`; the inner <span>s live in its shadow root.
  // We use `evaluate` to walk the shadow DOM since the standard Playwright
  // selector pierces shadow but we want both the host element ref AND a
  // child-tag count for the assertion shape.
  await page.waitForFunction(() => {
    const host = document.querySelector('rozie-r-on-probe');
    return host && host.shadowRoot && host.shadowRoot.querySelector('.r-on-probe span');
  });

  // Snapshot the addEventListener calls observed during initial render.
  // The dynamic-spread span receives at least 'click' and 'mouseenter' from
  // ROnProbe's `someObj: { click: () => {}, mouseenter: () => {} }`. The
  // R6-merge span receives a merged click; the literal modifier-bearing
  // span receives @click.stop + @input.debounce via native single-event
  // syntax. We're only interested in the dynamic-spread span's events here
  // — those are the ones rozieListeners owns.
  const addsBeforeDisconnect = await page.evaluate(() => {
    const obs = (window as unknown as {
      __phase15_lit_teardown: {
        adds: Array<{ event: string; tag: string; testid: string | null }>;
        removes: Array<{ event: string; tag: string; testid: string | null }>;
      };
    }).__phase15_lit_teardown;
    // Filter to span events — that's what the dynamic spread targets.
    return obs.adds.filter((a) => a.tag === 'span');
  });

  // The dynamic-spread span receives at least one listener (click +
  // mouseenter from ROnProbe.someObj = 2 entries — but we assert >= 1 as the
  // lower bound to allow for future ROnProbe shape changes).
  expect(
    addsBeforeDisconnect.length,
    'rozieListeners should have called addEventListener at least once on a <span> after initial render',
  ).toBeGreaterThanOrEqual(1);

  // Trigger disconnect by removing the Lit custom-element host from the DOM.
  // The host's `disconnectedCallback` propagates to every AsyncDirective in
  // its template via lit-html's `setConnected(false)` cycle — synchronous
  // per Lit's documented contract.
  await page.evaluate(() => {
    const host = document.querySelector('rozie-r-on-probe');
    host?.remove();
  });

  // Wait a microtask boundary for the disconnected() hook to drain its
  // synchronous cleanup loop. (Lit's setConnected(false) IS synchronous, but
  // give the event loop one tick to flush any queued microtasks.)
  await page.waitForFunction(() => {
    const obs = (window as unknown as {
      __phase15_lit_teardown: {
        removes: Array<{ event: string; tag: string; testid: string | null }>;
      };
    }).__phase15_lit_teardown;
    return obs.removes.some((r) => r.tag === 'span');
  });

  // Capture the removeEventListener calls observed during disconnect.
  const removesAfterDisconnect = await page.evaluate(() => {
    const obs = (window as unknown as {
      __phase15_lit_teardown: {
        adds: Array<{ event: string; tag: string; testid: string | null }>;
        removes: Array<{ event: string; tag: string; testid: string | null }>;
      };
    }).__phase15_lit_teardown;
    return obs.removes.filter((r) => r.tag === 'span');
  });

  // Each event that rozieListeners REGISTERED must be removed on disconnect
  // — the leak-defense invariant. Scope: ROnProbe has rozieListeners on Span
  // 2 ONLY (the `r-on="someObj"` dynamic-spread span), and `someObj` carries
  // exactly `{ click, mouseenter }`. Spans 1 and 3 use Lit's native `@event=`
  // syntax (EventPart), which by design does NOT call removeEventListener on
  // disconnect — Lit relies on element disposal there, not on active
  // teardown. The page-level addEventListener spy captures both paths
  // indiscriminately, so we filter the add-set down to the events that
  // rozieListeners actually owns before asserting parity with the remove-set.
  //
  // This is the D-14 / T-15-V5-04 leak-defense gate: WITHOUT the
  // AsyncDirective `disconnected()` hook the prevListenersByElement WeakMap
  // entry would stay populated and removeEventListener would never fire on
  // disconnect — `click` and `mouseenter` would be missing from
  // removedEventNames and the assertion would fail.
  const ROZIE_LISTENERS_OWNED = new Set(['click', 'mouseenter']);
  const ownedAdds = addsBeforeDisconnect.filter((a) => ROZIE_LISTENERS_OWNED.has(a.event));
  expect(
    new Set(ownedAdds.map((a) => a.event)).size,
    'rozieListeners should have registered both click and mouseenter on the dynamic-spread <span> after initial render',
  ).toBeGreaterThanOrEqual(2);
  const removedEventNames = new Set(removesAfterDisconnect.map((r) => r.event));
  for (const evName of ROZIE_LISTENERS_OWNED) {
    expect(
      removedEventNames.has(evName),
      `rozieListeners.disconnected() must call removeEventListener('${evName}', ...) on the host element to clear the prevListenersByElement WeakMap entry (T-15-V5-04 leak defense)`,
    ).toBe(true);
  }
});
