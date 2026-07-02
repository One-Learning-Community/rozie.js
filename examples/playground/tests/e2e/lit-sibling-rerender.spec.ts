// Phase 69 Plan 06 (D-04), residual (d).
//
// 69-05 verified `lit.html`'s `customElements.define` name-guard override
// (a pre-phase fix, commit 7b390d4b) reliably prevents the "sibling
// hot-redefine" crash — `NotSupportedError: ... already been defined` —
// under both sequential re-render and rapid-fire overlapping-render
// conditions, using a SYNTHETIC repro matching the real emitted shape
// (entry AND sibling both `@customElement`-decorated, per `emitLit.ts`).
//
// This spec codifies that exact verified methodology as a permanent smoke.
// It deliberately does NOT drive a real compiled `@rozie-ui` family through
// the playground UI: every real Lit demo that imports `@rozie/runtime-lit`
// (i.e. virtually all of them) currently hits a separate, pre-existing,
// unrelated importmap gap (`lit/directive.js` — see deferred-items.md's
// 69-05 entry) that would swamp this test with unrelated noise. Posting
// synthetic `render` messages directly at `/preview/lit.html` isolates the
// hot-redefine mechanism under test from that unrelated gap, exactly as
// 69-05's own verification did.
import { test, expect } from '@playwright/test';

const SIBLING_SRC = `
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('rozie-test-sibling')
export default class TestSibling extends LitElement {
  @property() label = '';
  render() {
    return html\`<span class="sibling">\${this.label}</span>\`;
  }
}
`;

function entrySrc(label: string): string {
  return `
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './Sibling';

@customElement('rozie-test-entry')
export default class TestEntry extends LitElement {
  render() {
    return html\`<rozie-test-sibling label="${label}"></rozie-test-sibling>\`;
  }
}
`;
}

function renderPayload(label: string) {
  return { type: 'render', code: entrySrc(label), css: '', siblings: { Sibling: SIBLING_SRC } };
}

test('sibling custom-element hot-redefine guard survives sequential + rapid-fire re-renders (residual d)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__msgs = [];
    window.addEventListener('message', (e) => {
      if (e.data && typeof e.data === 'object') (window as any).__msgs.push(e.data);
    });
  });

  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  // Drive the lit harness directly (not through the full playground app) —
  // see file header for why.
  await page.goto('/preview/lit.html');
  await page.waitForFunction(() => (window as any).__msgs?.some((m: any) => m.type === 'ready'));

  // 3 sequential renders, awaiting each ack — both the entry AND sibling
  // custom elements self-register (via @customElement) on every render;
  // each subsequent render's define() calls must be silently skipped by the
  // guard rather than throwing.
  for (let i = 0; i < 3; i++) {
    await page.evaluate((payload) => window.postMessage(payload, '*'), renderPayload(`seq-${i}`));
    await page.waitForFunction(
      (n) =>
        (window as any).__msgs.filter((m: any) => m.type === 'rendered' || m.type === 'error')
          .length >= n,
      i + 1,
      { timeout: 20_000 },
    );
  }

  // 5 rapid-fire renders, no await between postMessage calls — the race
  // Pitfall 3 describes. bootHarness's own renderToken supersedes stale
  // acks (a superseded render posts NEITHER 'rendered' nor 'error'), so we
  // can't count acks here; instead wait for the LAST render's content to
  // land and then assert no crash occurred anywhere along the way.
  for (let i = 0; i < 5; i++) {
    await page.evaluate((payload) => window.postMessage(payload, '*'), renderPayload(`rapid-${i}`));
  }
  await expect(page.locator('#app')).toContainText('rapid-4', { timeout: 20_000 });

  const msgs: Array<{ type: string; message?: string }> = await page.evaluate(
    () => (window as any).__msgs,
  );
  const errorMsgs = msgs.filter((m) => m.type === 'error');
  expect(errorMsgs, `harness posted error messages: ${JSON.stringify(errorMsgs)}`).toEqual([]);

  expect(
    consoleErrors,
    `console/page errors during hot-redefine re-render: ${consoleErrors.join('\n')}`,
  ).toEqual([]);

  // Belt-and-suspenders: explicitly confirm the exact crash text this
  // residual describes never appeared anywhere.
  const allText = JSON.stringify(msgs) + consoleErrors.join('\n');
  expect(allText).not.toContain('NotSupportedError');
  expect(allText).not.toContain('already been defined');
});
