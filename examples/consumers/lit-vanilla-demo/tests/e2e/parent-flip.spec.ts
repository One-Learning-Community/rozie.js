// Phase 06.4 Plan 03 — SC2 parent-flip-mid-lifecycle CustomEvent observation.
//
// Asserts that programmatic property writes on <rozie-counter> dispatch
// `value-change` CustomEvents with the right `detail`, `bubbles`, and
// `composed` flags so that the host page (outside the shadow root) can
// observe the change.
//
// In Lit-target output, value-change is fired by createLitControllableProperty
// in BOTH controlled and uncontrolled modes. The shadow-DOM re-render path on
// property writes is a v1 emitter limitation (the controllable does not call
// `host.requestUpdate()` after a property write); the EVENT path verified here
// is fully wired — `(el as any).value = 20` fires the CustomEvent with
// detail=20, bubbles=true, composed=true.
//
// The attribute-driven path (setAttribute → notifyAttributeChange → re-render)
// is verified in counter.spec.ts's third test.
import { test, expect } from '@playwright/test';

test('SC2 — value-change CustomEvent on programmatic write (bubbles + composed)', async ({
  page,
}) => {
  await page.goto('/src/pages/CounterPage.html');
  const counter = page.locator('#counter');

  // Install a listener that records each value-change event's detail,
  // bubbles, and composed flags. We do this in the page so the listener
  // executes in the real browser context.
  await page.evaluate(() => {
    (globalThis as unknown as { __events: unknown[] }).__events = [];
    const el = document.getElementById('counter');
    el?.addEventListener('value-change', (e: Event) => {
      const ce = e as CustomEvent;
      (globalThis as unknown as { __events: unknown[] }).__events.push({
        detail: ce.detail,
        bubbles: ce.bubbles,
        composed: ce.composed,
      });
    });
  });

  // Programmatic property write — mid-lifecycle.
  await counter.evaluate((el: Element) => {
    (el as unknown as { value: number }).value = 20;
  });

  const events = await page.evaluate(
    () => (globalThis as unknown as { __events: unknown[] }).__events,
  );
  expect(events.length).toBeGreaterThanOrEqual(1);
  const first = events[0] as {
    detail: number;
    bubbles: boolean;
    composed: boolean;
  };
  expect(first.detail).toBe(20);
  expect(first.bubbles).toBe(true);
  expect(first.composed).toBe(true);
});
