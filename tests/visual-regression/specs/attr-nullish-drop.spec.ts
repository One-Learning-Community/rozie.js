import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * quick-task 260608-sya (attr-binding-nullish-drop) — runtime ABSENCE proof.
 * Extended by quick 260802-v1v (seams 3+4).
 *
 * `examples/AttrNullishDrop.rozie` renders a single <span> with three
 * whole-value attribute bindings:
 *   (1) :data-x="$data.cond ? 'v' : null"             (cond=false → DROPS)
 *   (2) :aria-expanded="$data.cond ? 'true' : 'false'" (→ STAYS "false")
 *   (3) :title="$data.maybeNull"  (maybeNull=null      → DROPS)
 *
 * The dist-parity byte snapshot pins the `rozieAttr(...)` EMIT shape, but a
 * byte snapshot CANNOT prove the attribute is ABSENT at runtime (vs rendered as
 * `attr=""`). THIS spec is the absence proof: on every target, the dropped
 * attributes must not appear on the DOM element, while the never-nullish
 * `aria-expanded` must render the literal string "false" (the drop predicate is
 * `v == null` ONLY — `'false'` survives, protecting aria-/data- a11y).
 *
 * Seam 3+4 (quick 260802-v1v) added two more positions, both driven by a
 * `maybeNullProp: { type: String, default: null }` prop the host passes
 * nothing for (host/main.ts's AttrNullishDrop props map is `{}`, so the
 * default applies):
 *   (4) .attr-nullish-drop-prop :title="$props.maybeNullProp"  (→ DROPS)
 *   (5) .attr-nullish-drop-loop <i r-for :key="c" :title="$props.maybeNullProp">
 *       (→ title DROPS; the element must carry NO literal `key` attribute
 *       on any target — `key` is consumed by the loop's own reconciliation,
 *       never emitted as DOM)
 *
 * Before the seam 3+4 fix, Lit is expected RED on both: it renders
 * `title=""` instead of dropping (seam 3), and leaks `key="..."` onto the
 * loop `<i>` (seam 4). The other five targets are expected GREEN already.
 *
 * Playwright CSS locators pierce shadow DOM, so the span resolves on Lit too.
 * Per `feedback_vr_linux_baselines`: behavioral assertions only (no screenshot).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`attr-nullish-drop [${target}]: nullish bound attrs are DROPPED, 'false' STAYS`, async ({
    page,
  }) => {
    await page.goto(`/?example=AttrNullishDrop&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Template root is <div class="attr-nullish-drop"> wrapping a single
    // <span>probe</span> that carries the three attribute bindings.
    const span = mount.locator('.attr-nullish-drop span').first();
    await expect(span).toBeVisible({ timeout: 10_000 });
    await expect(span).toHaveText('probe');

    // (1) :data-x="cond ? 'v' : null" with cond=false → DROPPED. The element
    //     must NOT carry the attribute (NOT rendered as data-x="").
    const hasDataX = await span.evaluate((el) => el.hasAttribute('data-x'));
    expect(hasDataX).toBe(false);

    // (3) :title="$data.maybeNull" (null) → DROPPED.
    const hasTitle = await span.evaluate((el) => el.hasAttribute('title'));
    expect(hasTitle).toBe(false);

    // (2) :aria-expanded="cond ? 'true' : 'false'" → value is NEVER nullish; the
    //     literal "false" must render (a11y-meaningful; the drop predicate is
    //     `v == null` only).
    const ariaExpanded = await span.evaluate((el) =>
      el.getAttribute('aria-expanded'),
    );
    expect(ariaExpanded).toBe('false');

    // (4) seam 3 — :title="$props.maybeNullProp" (default: null, host passes
    //     nothing) → DROPPED. A RAW read of a nullable prop, NOT a
    //     wrapForDisplay ternary — this is the shape Lit was missing.
    const propSpan = mount.locator('.attr-nullish-drop-prop').first();
    await expect(propSpan).toBeVisible({ timeout: 10_000 });
    const hasPropTitle = await propSpan.evaluate((el) => el.hasAttribute('title'));
    expect(hasPropTitle).toBe(false);

    // (5) seam 4 — the r-for loop element must carry NO literal `key`
    //     attribute (key is consumed by the loop's own reconciliation
    //     mechanism, never emitted to the DOM) AND its own :title="$props.maybeNullProp"
    //     binding must also DROP.
    const loopItems = mount.locator('.attr-nullish-drop-loop');
    await expect(loopItems.first()).toBeVisible({ timeout: 10_000 });
    const loopCount = await loopItems.count();
    expect(loopCount).toBeGreaterThan(0);
    for (let i = 0; i < loopCount; i++) {
      const item = loopItems.nth(i);
      const hasKey = await item.evaluate((el) => el.hasAttribute('key'));
      expect(hasKey).toBe(false);
      const hasLoopTitle = await item.evaluate((el) => el.hasAttribute('title'));
      expect(hasLoopTitle).toBe(false);
    }
  });
}
