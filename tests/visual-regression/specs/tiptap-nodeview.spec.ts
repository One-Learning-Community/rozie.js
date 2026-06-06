import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Reactive node-view portal slot — the Phase 33 proving spec (Spike 009 @mention
 * pattern ported into the VR rig). This is where the phase goal is PROVEN: the
 * consumer fragment, mounted as a custom ProseMirror node, re-renders IN PLACE on
 * every engine transaction (no remount), across all 6 targets.
 *
 * The cell `TipTapNodeViewDemo.rozie` fills the TipTap `nodeView` REACTIVE portal
 * slot with NATIVE inline markup (the proven Spike-009 pattern — the reactive
 * portal re-renders native elements in place):
 *   - a `[data-testid=mention-chip]` chip for the `rozieMention` ATOM node
 *     (Spike 009 / REQ-26) — reads node.attrs.label + selected;
 *   - a `[data-testid=callout-chrome]` for the `rozieCallout` EDITABLE node
 *     (Spike 008 / REQ-24) — reactive chrome wrapping a `[data-rozie-hole]` the
 *     bridge grafts ProseMirror's contentDOM into.
 *
 * The in-place proof (REQ-26): the reactive portal mounts the fragment ONCE and
 * re-renders it via handle.update(scope) on every engine transaction. Each
 * assertion captures the chip's underlying DOM node BEFORE a transaction and
 * asserts the SAME DOM node is still present AFTER (JS `===` via evaluateHandle)
 * while the reactive read (label / selected) DID change. A remount (the failure
 * mode) would replace the DOM node, failing the identity assertion.
 *
 * REQ-25 — Angular is the FIRST-CLASS runtime-verification target. The transactions
 * are pure ProseMirror, reached via window.__nvEditor (the editor is a nodeView
 * scope param the chip stashes via captureEditor), which works identically on all
 * 6 INCLUDING Angular (whose component ref resolves to the host element, not the
 * $expose handle).
 *
 * Behavioral (DOM/serializer) assertions only — runnable on the macOS host (the
 * pixel tier is the SEPARATE TipTapNodeViewScreenshot leg in matrix.spec.ts).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// Phase 33-04 follow-up — the Solid reactive-portal emitter now passes the scope
// as a SIGNAL ACCESSOR and the Solid consumer fill reads `_rozieScope().<param>`
// inside the render computation, so every read re-tracks on setScopeSig → the
// consumer fragment re-renders IN PLACE (no remount). This fixes the former
// "Solid foreign-slot accessor limitation" (destructured `({ node, selected }) =>`
// captured statically) that gated Solid to test.fixme. Solid now runtime-proves
// the reactive primitive alongside the other 5 targets — REQ-26 is 6/6.
const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`tiptap-nodeView [${target}]: reactive in-place re-render — chip, selection, relabel, identity survives`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapNodeView&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ProseMirror booted.
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // ---- 1. the @mention atom node view rendered the consumer chip ----
    // The chip reads node.attrs.label → "@alice" and starts unselected.
    const chip = page.getByTestId('mention-chip').first();
    await expect(chip).toBeVisible({ timeout: 10_000 });
    // The "@" prefix is a CSS ::before glyph (not in textContent); the label
    // itself is the live node.attrs.label, mirrored onto data-label.
    await expect(chip).toHaveText('alice');
    await expect(chip).toHaveAttribute('data-label', 'alice');
    await expect(chip).toHaveAttribute('data-selected', 'false');

    // Capture the underlying DOM node — it must be the SAME node after every
    // reactive transition (in-place re-render, no remount).
    const chipNodeBefore = await chip.elementHandle();
    expect(chipNodeBefore).toBeTruthy();

    // ---- 2. attr-change transaction → update(node) → label re-renders ----
    // (Driven first, on the unselected node, so the proof isolates the
    // update(node) trigger from the selection trigger.)
    await mount.getByTestId('nv-relabel').click();
    await expect
      .poll(async () => await chip.getAttribute('data-label'), {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toBe('bob');
    // In-place: same DOM node, the reactive update re-rendered it (no remount).
    {
      const now = await chip.elementHandle();
      const same = await page.evaluate(
        ([x, y]) => x === y,
        [chipNodeBefore, now] as const,
      );
      expect(same).toBe(true);
    }

    // ---- 3. selection transaction → selectNode → data-selected flips ----
    await mount.getByTestId('nv-select').click();
    await expect
      .poll(async () => await chip.getAttribute('data-selected'), {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toBe('true');
    // Still the SAME DOM node — re-rendered in place.
    {
      const now = await chip.elementHandle();
      const same = await page.evaluate(
        ([x, y]) => x === y,
        [chipNodeBefore, now] as const,
      );
      expect(same).toBe(true);
    }

    // ---- 4. deselect transaction → deselectNode → data-selected back to false ----
    await mount.getByTestId('nv-deselect').click();
    await expect
      .poll(async () => await chip.getAttribute('data-selected'), {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toBe('false');
    {
      const now = await chip.elementHandle();
      const same = await page.evaluate(
        ([x, y]) => x === y,
        [chipNodeBefore, now] as const,
      );
      expect(same).toBe(true);
    }
  });
}

/**
 * REQ-24 composition smoke — reactive chrome AROUND an editable contentDOM hole.
 *
 * The `rozieCallout` editable node renders reactive chrome (a tone badge)
 * wrapping a `[data-rozie-hole]` placeholder the per-target bridge grafts
 * ProseMirror's contentDOM into. This proves:
 *   (a) typing into the hole round-trips through editor.getHTML() INSIDE the
 *       data-rozie-callout node (the hole is genuinely ProseMirror-owned, not a
 *       framework-rendered contenteditable div — Spike 008);
 *   (b) a CHROME-update transaction (changing the tone attr) re-renders the badge
 *       IN PLACE and does NOT detach/clobber the grafted contentDOM — the editable
 *       subtree stays connected after the chrome update.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`tiptap-nodeView [${target}]: composition — contentDOM survives reactive chrome update (REQ-24)`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapNodeView&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });

    // ---- 1. the editable callout chrome rendered + grafted its contentDOM ----
    const callout = page.getByTestId('callout-chrome').first();
    await expect(callout).toBeVisible({ timeout: 10_000 });
    await expect(callout).toHaveAttribute('data-tone', 'info');

    // The grafted contentDOM hole carries the editable seed text (the node's
    // inline content was rendered by ProseMirror INTO the [data-rozie-hole]).
    const hole = callout.locator('[data-rozie-hole]').first();
    await expect(hole).toBeVisible();
    await expect
      .poll(async () => (await hole.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toContain('edit me');

    // ---- 2. type into the hole through ProseMirror → serializer round-trips ----
    await mount.getByTestId('nv-type').click();
    // editor.getHTML() (surfaced into the out pane) serializes the typed text
    // INSIDE the data-rozie-callout node — proving the hole is engine-owned.
    await expect
      .poll(async () => (await mount.getByTestId('nv-out').textContent()) ?? '', {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toContain('edit me EDITED');
    await expect(mount.getByTestId('nv-out')).toContainText('data-rozie-callout');

    // ---- 3. chrome-update transaction → badge re-renders IN PLACE ----
    await mount.getByTestId('nv-retone').click();
    await expect
      .poll(async () => await callout.getAttribute('data-tone'), {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toBe('warn');
    // The grafted contentDOM hole was NOT clobbered by the chrome update — still
    // connected and still holding the (now edited) editable content (REQ-24).
    const holeAfter = callout.locator('[data-rozie-hole]').first();
    await expect(holeAfter).toBeVisible();
    await expect
      .poll(async () => (await holeAfter.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [100, 200, 400],
      })
      .toContain('edit me EDITED');
  });
}
