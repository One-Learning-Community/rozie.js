import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/lexical — the cross-framework Lexical rich-text-editor family (Phase 76,
 * D-09). This spec is the RUNTIME PROOF that closes the compile-only caveats waves
 * 2–4 left standing (each of those plans could only confirm the wiring was PRESENT
 * in all five emits, not that it ACTIVATES in a browser). Per target
 * (react/vue/svelte/angular/solid — NO Lit; that is v1.1, D-10) it drives the
 * LexicalBehaviorDemo cell (the shell + selection-reading Toolbar + History/List/Link
 * plugins + the LexicalMentionDriver) and asserts the DOM outcome of every mechanism:
 *
 *   1. MOUNT + typed input — the shell's createEditor + setRootElement path booted a
 *      real contenteditable that accepts keystrokes.
 *   2. History undo/redo — the driver dispatches UNDO/REDO_COMMAND; only the
 *      HistoryPlugin's registerHistory handles them (the RichText baseline does not),
 *      so a working undo/redo proves that plugin ACTIVATED (the microtask-deferred
 *      inject-registry idiom survived the child-before-parent $onMount ordering).
 *   3. Bold — dispatch → <strong> AND the toolbar button's `.active` class reflects
 *      the caret (the bidirectional dispatch→mutation + registerUpdateListener loop),
 *      with @mousedown.prevent preserving the selection across the button press.
 *   4. List — the ListPlugin's registerList (node-transform) turns the selection into
 *      a <ul>.
 *   5. Link — the LinkPlugin's TOGGLE_LINK_COMMAND handler (command) wraps it in <a>.
 *   6. @mention — the driver inserts a MentionNode; the per-target decorator BRIDGE
 *      (D-06/REQ-39) renders the native `.rozie-mention` pill into the Lexical-owned
 *      host span, and removing the node tears the pill down (no leak, T-76-04-LEAK).
 *
 * Behavioral assertions only (the pixel tier is the SEPARATE screenshot leg below,
 * per feedback_vr_linux_baselines). The editor content root is `.rozie-lexical-content`;
 * toolbar buttons are queried by aria-label; driver buttons by data-testid.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`lexical [${target}]: editor mounts + History/List/Link/Bold/@mention all run at runtime`, async ({
    page,
  }) => {
    await page.goto(`/?example=LexicalBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + typed input ----
    const content = mount.locator('.rozie-lexical-content').first();
    await expect(content).toBeVisible({ timeout: 10_000 });
    await content.click();
    await page.keyboard.type('alpha beta');
    await expect(content).toContainText('alpha beta', { timeout: 5_000 });

    // ---- 2. History undo / redo (proves HistoryPlugin.registerHistory activated) ----
    // The driver's Undo button dispatches lexical.UNDO_COMMAND; only registerHistory
    // handles it, so the typed run disappearing is the proof the plugin is live.
    await mount.getByTestId('undo').click();
    await expect
      .poll(async () => (await content.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [100, 250, 500],
      })
      .not.toContain('alpha beta');
    await mount.getByTestId('redo').click();
    await expect
      .poll(async () => (await content.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [100, 250, 500],
      })
      .toContain('alpha beta');

    // ---- 3. Bold: dispatch → <strong> AND the toolbar reflects the active state ----
    await content.click();
    await page.keyboard.press('ControlOrMeta+a');
    const boldBtn = mount.getByRole('button', { name: 'Bold' });
    await boldBtn.click();
    // A <strong> wrapping the selected run = the FORMAT_TEXT_COMMAND dispatch mutated
    // the doc (RichText baseline). Its presence is the write-side proof.
    await expect(content.locator('strong')).toHaveCount(1, { timeout: 5_000 });
    // The selection still covers the now-bold run, so the toolbar's
    // registerUpdateListener marks the button active — the READ-side (bidirectional)
    // proof. If @mousedown.prevent had NOT preserved the selection, the caret would
    // have collapsed and this would stay inactive.
    await expect(boldBtn).toHaveClass(/active/, { timeout: 5_000 });

    // ---- 4. List: node-transform → <ul> ----
    const listBtn = mount.getByRole('button', { name: 'Bullet list' });
    await listBtn.click();
    await expect(content.locator('ul')).toHaveCount(1, { timeout: 5_000 });

    // ---- 5. Link: command → <a> ----
    const linkBtn = mount.getByRole('button', { name: 'Link' });
    await linkBtn.click();
    await expect(content.locator('a')).toHaveCount(1, { timeout: 5_000 });

    // ---- 6. @mention: bridge renders the pill, removal tears it down ----
    await mount.getByTestId('insert-mention').click();
    const mentionPill = content.locator('.rozie-mention');
    await expect(mentionPill).toHaveCount(1, { timeout: 5_000 });
    await expect(mentionPill).toContainText('Ada Lovelace');
    await mount.getByTestId('remove-mention').click();
    await expect(content.locator('.rozie-mention')).toHaveCount(0, {
      timeout: 5_000,
    });
  });
}

/**
 * Content-stable screenshot leg — the D-09 showcase pixel cell.
 *
 * Routes to the deterministic LexicalScreenshot cell (LexicalScreenshotDemo.rozie):
 * a FIXED seeded document (a bold run + an @mention chip + a two-item bullet list) +
 * the selection-reading toolbar, never focused (contenteditable paints no caret
 * unfocused — the TipTap screenshot precedent). Per D-10 the ONE `LexicalScreenshot.png`
 * baseline is shared across all five targets (the Vue reference render), so this leg
 * also asserts the cross-target byte-identity of the editor + toolbar + @mention pill.
 *
 * Baselines are regenerated ONLY in pinned Linux Docker (feedback_vr_linux_baselines;
 * feedback_vr_macos_text_node_kerning) — locally this leg baseline-gates to test.fixme
 * until the Linux PNG exists.
 */
const SCREENSHOT_DIR = resolve(__dirname, '../__screenshots__');
const screenshotBaselineExists = existsSync(
  resolve(SCREENSHOT_DIR, 'LexicalScreenshot.png'),
);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || KNOWN_FAILING.has(target) || !screenshotBaselineExists
      ? test.fixme
      : test;
  runner(`lexical [${target}]: content-stable screenshot (seeded, unfocused)`, async ({
    page,
  }) => {
    await page.goto(`/?example=LexicalScreenshot&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The driver seeds the fixed doc one microtask after mount; poll the bold run's
    // text into the rendered content, then wait for the @mention pill (the Angular
    // bridge renders it asynchronously) + the two list items.
    const content = mount.locator('.rozie-lexical-content').first();
    await expect
      .poll(async () => (await content.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [200, 400, 800],
      })
      .toContain('Hello world');
    await expect(content.locator('.rozie-mention')).toHaveCount(1, {
      timeout: 5_000,
    });
    await expect(content.locator('ul li')).toHaveCount(2, { timeout: 5_000 });

    // The editor is never focused (no caret/selection painted); a brief settle for
    // layout only.
    await page.waitForTimeout(200);

    await expect(mount).toHaveScreenshot('LexicalScreenshot.png', {
      maxDiffPixels: 2,
      animations: 'disabled',
    });
  });
}
