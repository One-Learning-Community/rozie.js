import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 88 Plan 03 (D-09/D-10) — nested-slot-in-fallback runtime proof.
 *
 * The single genuinely unprovable-by-reading item in Phase 88: whether Lit's
 * `RozieSlotDistributor` actually DISTRIBUTES a static `<slot>` nested inside a
 * dynamic-name family slot's fallback, under `r-for`. Compile-time wiring for
 * this shape is confirmed correct on all six targets (88-01/88-CONTEXT.md);
 * this spec proves the runtime behavior on all six, not Lit alone, because the
 * distributor is a Lit-specific workaround for a problem the other five
 * targets solve differently — a shared ordering bug would surface only as
 * cross-target divergence.
 *
 * Fixture topology (examples/demos/NestedSlotFallbackDemo{,Producer}.rozie):
 * the producer loops `r-for` over a `columns` prop, and for each column
 * renders a three-tier precedence chain:
 *   1. a dynamic-name family slot `cell-<col.key>` (exact fills win here)
 *   2. whose inline fallback is a static generic slot `cell` (generic fills
 *      land here when no exact family fill exists)
 *   3. whose own inline fallback is literal `builtin:<value>` text (when
 *      neither an exact nor a generic fill exists)
 *
 * The consumer mounts TWO producer instances so all four observable outcomes
 * exist simultaneously, no conditional fill required:
 *   - `data-nsf-instance="with-generic"` (columns a1/a2): a1 has an exact
 *     `#cell-a1` fill AND the instance has a generic `#cell` fill → a1 must
 *     resolve to the family tier, a2 (no exact fill) to the generic tier.
 *   - `data-nsf-instance="no-generic"` (columns b1/b2): b1 has an exact
 *     `#cell-b1` fill; no generic fill exists at all → b1 resolves to the
 *     family tier, b2 falls all the way to the built-in tier.
 *
 * `data-testid="toggle-columns"` reverses both column arrays' order,
 * forcing the `r-for` loop to re-render, so the spec re-asserts the same
 * four outcomes post-toggle to prove the distributor re-distributes rather
 * than latching its first assignment.
 *
 * No pixel-diff assertion or PNG baseline dir is added — per D-09, a
 * screenshot cannot distinguish "the distributor placed the node" from "the
 * fallback happened to render the same thing", which is exactly the
 * ambiguity this proof exists to remove. DOM assertions only.
 *
 * Wiring (D-09's recipe, mirrors dynamic-slot-name.spec.ts exactly):
 *     (a) examples/demos/NestedSlotFallbackDemo.rozie — consumer + toggle
 *     (b) examples/demos/NestedSlotFallbackDemoProducer.rozie — producer with
 *         `data-rozie-slot-name="…"` wrappers around each per-column row so
 *         the spec can locate projected content independent of class
 *         hashing / shadow-DOM differences across targets
 *     (c) tests/visual-regression/host/main.ts EXAMPLES + LIT_TAGS + PROPS
 *         entries so the standard `?example=NestedSlotFallback&target=<t>`
 *         URL router mounts the demo
 *     (d) Per-target gate `dist/<target>/host/entry.<target>.html` (same
 *         build-availability pattern dynamic-slot-name.spec.ts uses)
 *
 * Lit shadow-DOM shape (verified empirically before writing these
 * assertions, per the plan's Task 3 instruction — see 88-03-SUMMARY.md for
 * the full DOM dump): the dynamic family dispatch is JS-conditional, not a
 * native `<slot>` — an EXACT family match (a1, b1) never renders a `<slot>`
 * element at all, the matched fill's rendered output is spliced in inline.
 * A family MISS falls through to exactly ONE native `<slot name="cell">`
 * (a2, b2) — never a two-level nested `<slot>`-in-`<slot>` chain, because
 * the outer dynamic slot is JS-conditional, not native shadow-DOM
 * projection. `getSlotText` below (reused verbatim from
 * dynamic-slot-name.spec.ts) therefore resolves all four cases correctly
 * unmodified: its `querySelector('slot')` finds nothing for a1/b1 and falls
 * back to the wrapper's own `textContent`; for a2 it reads the one native
 * slot's `assignedNodes`; for b2 (no assignment) it reads that same slot's
 * own fallback `textContent`.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

/**
 * Read the projected text content of the producer's slot wrapper for column
 * key `name`. Target-agnostic: walks both light-DOM and shadow-DOM, and
 * resolves the slot via `assignedNodes({ flatten: true })` when the wrapper
 * contains a `<slot>` element (Lit's shadow-DOM projection). Falls back to
 * plain textContent for the 5 light-DOM targets, and for the Lit exact-match
 * case where no `<slot>` element is rendered at all (see header comment).
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
  runner(`nested-slot-fallback [${target}]: exact family / generic / built-in precedence resolves correctly under r-for`, async ({
    page,
  }) => {
    await page.goto(`/?example=NestedSlotFallback&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Pre-toggle: all four tier outcomes observable simultaneously.
    await expect.poll(() => getSlotText(page, 'a1'), { timeout: 5_000 }).toContain('family:');
    await expect.poll(() => getSlotText(page, 'a2'), { timeout: 5_000 }).toContain('generic:');
    await expect.poll(() => getSlotText(page, 'b1'), { timeout: 5_000 }).toContain('family:');
    await expect.poll(() => getSlotText(page, 'b2'), { timeout: 5_000 }).toContain('builtin:');

    // Toggle: reverses both column arrays' order, forcing the r-for loop to
    // re-render. Re-assert the identical four outcomes to prove the
    // distributor re-distributes rather than latching its first assignment.
    await page.getByTestId('toggle-columns').click();

    await expect.poll(() => getSlotText(page, 'a1'), { timeout: 5_000 }).toContain('family:');
    await expect.poll(() => getSlotText(page, 'a2'), { timeout: 5_000 }).toContain('generic:');
    await expect.poll(() => getSlotText(page, 'b1'), { timeout: 5_000 }).toContain('family:');
    await expect.poll(() => getSlotText(page, 'b2'), { timeout: 5_000 }).toContain('builtin:');
  });
}
