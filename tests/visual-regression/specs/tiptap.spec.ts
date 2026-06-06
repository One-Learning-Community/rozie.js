import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Rich-text engine behavioral smoke — TipTap (ProseMirror).
 *
 * TipTap is the contenteditable two-way-binding archetype: edits flow back via
 * TipTap's `onUpdate` (not a DOM input event), and the wrapper reflects
 * consumer-driven writes into the live document through `$watch(() => $props.html)`
 * (echo-guarded). `examples/demos/TipTapBehaviorDemo.rozie` seeds a single
 * `<p>Hello world</p>` (no list) so the FIRST `<ul>` that appears is an
 * unambiguous signal that the bullet-list command ran.
 *
 *   1. **Mount + content.** The editor mounts (ProseMirror adds `.ProseMirror`
 *      to its contenteditable) and renders the seed text — proves the
 *      $onMount → new Editor() path picked up `$props.html`.
 *
 *   2. **Command via the internal toolbar (all 6 targets).** The wrapper's own
 *      "Bullet list" toolbar button runs `editor.chain().focus().toggleBulletList()
 *      .run()`. Clicking it wraps the seed paragraph in a `<ul>` — the command
 *      proof that works on every target without a handle ref.
 *
 *   3. **$expose handle (5 ref-resolving targets).** The demo's handle buttons call
 *      `$refs.ed.undo()` (reverts the list) and `$refs.ed.getHTML()` (reads the
 *      live doc). On Angular a component ref resolves to the host element rather
 *      than the exposed handle, so those buttons optional-chain to "(no handle)" —
 *      the documented per-target ref idiom (same gate as code-mirror.spec.ts).
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only (the
 * pixel tier is the SEPARATE TipTapScreenshot leg at the bottom).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<typeof TARGETS[number]> = new Set<
  typeof TARGETS[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`tiptap [${target}]: editor mounts, content renders, a command mutates the doc`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // ---- 1. mount + seed content ----
    // ProseMirror adds `.ProseMirror` to the contenteditable it owns once the
    // editor finishes booting — the deterministic post-mount signal. The CSS
    // locator pierces Lit's open shadow root.
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await editor.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [200, 400, 800],
      })
      .toContain('Hello world');

    // No list in the seed yet.
    await expect(page.locator('.ProseMirror ul')).toHaveCount(0);

    // ---- 2. command via the wrapper's internal toolbar (ALL 6 targets) ----
    // The internal "Bullet list" button runs
    // editor.chain().focus().toggleBulletList().run(); the seed paragraph becomes
    // a <ul><li>. getByRole matches the button's aria-label and pierces shadow DOM.
    const bulletBtn = page.getByRole('button', { name: 'Bullet list' });
    await expect(bulletBtn).toBeVisible({ timeout: 5_000 });
    await bulletBtn.click();
    await expect
      .poll(async () => await page.locator('.ProseMirror ul').count(), {
        timeout: 5_000,
        intervals: [200, 400, 800],
      })
      .toBe(1);

    // ---- 3. $expose handle (5 ref-resolving targets) ----
    // Angular's component ref is the host element, not the handle — its buttons
    // optional-chain to no-ops / "(no handle)". The 5 others exercise the handle.
    if (target !== 'angular') {
      // undo() reverts the bullet-list command — the <ul> disappears.
      await mount.getByTestId('handle-undo').click();
      await expect
        .poll(async () => await page.locator('.ProseMirror ul').count(), {
          timeout: 5_000,
          intervals: [200, 400, 800],
        })
        .toBe(0);

      // getHTML() reads the live document back into the state pane.
      await mount.getByTestId('handle-get-html').click();
      await expect(mount.getByTestId('state-out')).toContainText('Hello world', {
        timeout: 5_000,
      });
    }
  });
}

/**
 * Content-stable screenshot leg — Phase 32.
 *
 * A SEPARATE leg from the behavioral block. Routes to the deterministic
 * `TipTapScreenshot` cell (TipTapScreenshotDemo.rozie): a fixed rich-HTML doc +
 * a caret-neutralized `editorProps` override + NO editor focus. Contenteditable
 * is far easier to screenshot than canvas/CodeMirror (ProseMirror uses the native
 * caret, which an unfocused editor never paints), so no async-measure settle hack
 * is needed beyond the `.ProseMirror` content poll.
 *
 * Baselines are regenerated ONLY in pinned Linux Docker (feedback_vr_linux_
 * baselines; feedback_vr_macos_text_node_kerning) — locally this leg baseline-
 * gates to `test.fixme` until the Linux PNG exists.
 */
const SCREENSHOT_DIR = resolve(__dirname, '../__screenshots__');
const screenshotBaselineExists = existsSync(
  resolve(SCREENSHOT_DIR, 'TipTapScreenshot.png'),
);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner =
    !built || KNOWN_FAILING.has(target) || !screenshotBaselineExists
      ? test.fixme
      : test;
  runner(`tiptap [${target}]: content-stable screenshot (caret-neutralized, unfocused)`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapScreenshot&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Poll the fixed doc into the rendered `.ProseMirror` — proves the editor
    // mounted and painted the rich content. Do NOT focus the editor.
    const editor = mount.locator('.ProseMirror').first();
    await expect
      .poll(async () => (await editor.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [200, 400, 800],
      })
      .toContain('Release notes');

    // Brief settle for layout; the editor is never focused and the caret is
    // neutralized, so there is no blink/selection source to wait out.
    await page.waitForTimeout(200);

    await expect(mount).toHaveScreenshot('TipTapScreenshot.png', {
      maxDiffPixels: 2,
      animations: 'disabled',
    });
  });
}
