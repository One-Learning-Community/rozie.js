import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 07.2 Plan 04 Task 3 — Dynamic slot-name runtime swap (R5 acceptance).
 *
 * Verifies the runtime behavior of R5 dynamic-name dispatch end-to-end across
 * all 6 targets: the consumer's `<template #[$data.slotName]>` projection
 * targets the producer slot whose name matches `slotName` at runtime, and
 * mutating `slotName` swaps which producer slot the fill body lands in.
 *
 * Topology:
 *   1. Consumer (the `consumer-dynamic-name` slot-matrix fixture) declares:
 *        <data>{ slotName: 'a' }</data>
 *        <template #[$data.slotName]>Dynamic fill</template>
 *      consumed inside a `<Producer>` that declares 2 named slots
 *      (`<slot name="a">A default</slot>`, `<slot name="b">B default</slot>`).
 *   2. Initial render: slotName === 'a' → the body "Dynamic fill" projects
 *      into slot "a"; slot "b" renders its defaultContent "B default".
 *   3. Runtime toggle (programmatic via the host page's exposed setter or
 *      query-param-driven reload): slotName ← 'b' → the body now projects
 *      into slot "b"; slot "a" renders "A default".
 *
 * What we assert (when the spec is unblocked):
 *   - Pre-toggle: slot "a" container contains "Dynamic fill"; slot "b"
 *     container contains "B default".
 *   - Post-toggle: slot "a" container contains "A default"; slot "b"
 *     container contains "Dynamic fill".
 *   - The swap is observed across all 6 targets (one Playwright iteration
 *     per target column — matches the matrix.spec.ts iteration shape).
 *
 * Un-gated 2026-05-17 (post-Phase 07.3.2.1 F-07.3.2-11-A closure): the
 * runtime behaviour the spec asserts now works in all 6 targets. Wiring:
 *
 *     (a) examples/demos/DynamicSlotNameDemo.rozie     — consumer + toggle button
 *     (b) examples/demos/DynamicSlotNameDemoProducer.rozie — producer with
 *         `data-rozie-slot-name="…"` wrappers around each named slot so the
 *         spec can locate projected content independent of class hashing /
 *         shadow-DOM differences across targets
 *     (c) tests/visual-regression/host/main.ts EXAMPLES + LIT_TAGS entries
 *         so the standard `?example=DynamicSlotName&target=<t>` URL router
 *         mounts the demo
 *     (d) Per-target gate `dist/<target>/host/entry.<target>.html` (same
 *         build-availability pattern modal-consumer-close.spec.ts uses)
 *
 * Lit + Vue dispatch is runtime-functional via native projection
 * mechanisms (Lit shadow-DOM `slot="${expr}"`, Vue compiler-sfc
 * `<template #[expr]>`). React/Solid/Svelte/Angular dispatch resolved
 * through Plans 07.3.2-07..10 + 07.3.2.1-01 producer-side intake +
 * consumer-side [templates]= input binding work (F-07.3.2-05-A +
 * F-07.3.2-11-A closures).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Phase 07.6 (2026-05-19) — `LIT_DYNAMIC_NAME_GAP` retired. The original
// 2026-05-17 diagnosis ("dispatched body lands in the default position")
// was misleading: empirical probing via slot.assignedNodes() shows the Lit
// emit DOES correctly project `<div slot="${this._slotName.value}">…</div>`
// into the producer's `<slot name="X">` via standard shadow-DOM slotting,
// and the projection follows toggles in lockstep. The actual failure was
// in this spec's assertion: a `toContainText` check on the shadow-DOM
// wrapper `[data-rozie-slot-name="a"]` doesn't see projected content
// because shadow-tree textContent doesn't traverse light-DOM-assigned
// nodes. Solution: the assertion now reads the slot's projected text via
// a target-agnostic helper that handles both light-DOM and shadow-DOM
// projection — see `getSlotText` below.

/**
 * Read the projected text content of the producer's slot wrapper for slot
 * `name`. Target-agnostic: walks both light-DOM and shadow-DOM, and resolves
 * the slot via `assignedNodes({ flatten: true })` when the wrapper contains
 * a `<slot>` element (Lit's shadow-DOM projection). Falls back to plain
 * textContent for the 5 light-DOM targets.
 */
async function getSlotText(page: import('@playwright/test').Page, name: string): Promise<string> {
  return page.evaluate((slotName) => {
    function findAll(root: Element | Document | ShadowRoot | null | undefined, sel: string, found: Element[] = []): Element[] {
      if (!root) return found;
      if ((root as Element).matches?.(sel)) found.push(root as Element);
      const shadowRoot = (root as Element).shadowRoot;
      if (shadowRoot) findAll(shadowRoot, sel, found);
      const children = (root as Element).children ?? [];
      for (const c of Array.from(children)) findAll(c, sel, found);
      return found;
    }
    const wrapper = findAll(document, `[data-rozie-slot-name="${slotName}"]`)[0];
    if (!wrapper) return '<no-wrapper>';
    const slotEl = wrapper.querySelector('slot');
    if (slotEl) {
      const assigned = (slotEl as HTMLSlotElement).assignedNodes({ flatten: true });
      if (assigned.length === 0) return (slotEl.textContent ?? '').trim();
      return assigned
        .map((n) => (n.textContent ?? '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
    }
    return (wrapper.textContent ?? '').trim();
  }, name);
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`dynamic-slot-name [${target}]: runtime toggle of slotName swaps the projected fill`, async ({
    page,
  }) => {
    await page.goto(`/?example=DynamicSlotName&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Pre-toggle assertions: body should be in slot "a", default in slot "b".
    // Use polling expectation around `getSlotText` so the async mount completes.
    await expect.poll(() => getSlotText(page, 'a'), { timeout: 5_000 }).toContain('Dynamic fill');
    await expect.poll(() => getSlotText(page, 'b'), { timeout: 5_000 }).toContain('B default');

    // Programmatic toggle of slotName from 'a' to 'b'. The host page
    // exposes a button or input element that mutates the consumer's
    // reactive `slotName` data field. Each target's host page wires it
    // identically per its idiom (Vue ref().value=, React useState setter,
    // Svelte $state proxy assignment, Solid signal setter, Lit signal
    // setter, Angular signal()).
    await page.getByTestId('toggle-slot-name').click();

    // Post-toggle assertions: body should be in slot "b", default in "a".
    await expect.poll(() => getSlotText(page, 'a'), { timeout: 5_000 }).toContain('A default');
    await expect.poll(() => getSlotText(page, 'b'), { timeout: 5_000 }).toContain('Dynamic fill');
  });
}
