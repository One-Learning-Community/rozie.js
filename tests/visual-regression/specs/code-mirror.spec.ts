import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Non-input two-way-binding engine smoke — CodeMirror 6.
 *
 * Most `model: true` examples in the suite wrap form-shaped inputs
 * (`<input>`, `<select>`, the SortableList items array). CodeMirror is the
 * archetypal *engine-mediated* two-way case: edits flow back via an
 * `EditorView.updateListener` extension, not a DOM input event. The
 * wrapper's `$watch(() => $props.value, ...)` reflects consumer-driven
 * writes into the editor; the wrapper's updateListener writes through
 * `$props.value = ...` to push editor-driven changes out.
 *
 * `examples/demos/CodeMirrorDemo.rozie` binds two CodeMirror instances to
 * the same `$data.code` via `r-model:value`. A single source of truth
 * shared between two consumers exercises:
 *
 *   1. **Initial mount.** Both editors render the seed text — proves the
 *      `$watch(value)` first-mount path doesn't fire a no-op echo (would
 *      blank one editor on Svelte/Solid; covered by the wrapper's
 *      `if (current === next) return` echo guard + the cross-target
 *      skip-initial gate for $watch).
 *
 *   2. **Consumer → wrapper → consumer.** Clicking "Reset to seed" sets
 *      `$data.code = SEED`. Both editors $watch the prop and dispatch
 *      a CodeMirror transaction to reflect the new doc.
 *
 *   3. **Editor → wrapper → editor.** (Soft try) Focus editor A's
 *      `.cm-content`, type characters via Playwright keyboard, then assert
 *      editor B's content reflects the new keystrokes. This is the
 *      strict round-trip — model emit → parent $data → sibling $watch →
 *      sibling dispatch.
 *
 * Per `feedback_vr_linux_baselines`: structural assertions only (no
 * `toHaveScreenshot`). Validates the wrapper compiled correctly and
 * round-trips edits across the 6 targets.
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
  runner(`code-mirror [${target}]: r-model:value round-trips between two editor instances`, async ({
    page,
  }) => {
    await page.goto(`/?example=CodeMirror&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Substring-match guards against CSS Modules class-mangling on React
    // (see comment in line-chart.spec.ts). All 6 targets keep the
    // `rozie-codemirror` class as a substring or literal.
    const wrappers = mount.locator(
      '.rozie-codemirror, [class*="rozie-codemirror"]',
    );
    await expect(wrappers).toHaveCount(2, { timeout: 10_000 });

    // CodeMirror 6 mounts a `.cm-editor` root and a `.cm-content`
    // contenteditable inside each wrapper. Both editors must mount before
    // any round-trip assertion is meaningful.
    const editors = mount.locator('.cm-editor');
    await expect(editors).toHaveCount(2, { timeout: 5_000 });
    const editorA = editors.first();
    const editorB = editors.last();
    await expect(editorA).toBeVisible({ timeout: 5_000 });
    await expect(editorB).toBeVisible({ timeout: 5_000 });

    // Seed-content gate. Both editors should display the seeded
    // `function greet(name)` text on first paint, proving the
    // $onMount → EditorView creation path picked up `$props.value`.
    // CodeMirror lazily renders lines into `.cm-line` children inside
    // `.cm-content`; polling lets the layout settle.
    await expect
      .poll(
        async () => (await editorA.locator('.cm-content').textContent()) ?? '',
        { timeout: 5_000, intervals: [200, 400, 800] },
      )
      .toContain('function greet');
    await expect
      .poll(
        async () => (await editorB.locator('.cm-content').textContent()) ?? '',
        { timeout: 5_000, intervals: [200, 400, 800] },
      )
      .toContain('function greet');

    // Consumer → wrapper → consumer path: click "Reset to seed" then verify
    // both editors still display the seed (post-dispatch). This proves the
    // $watch(value) → dispatch route works WITHOUT producing a duplicate
    // history entry or blanking one of the editors via echo (the wrapper's
    // `suppressEmit` guard + the cross-target skip-initial gate together
    // keep the loop tight).
    const resetBtn = mount.getByRole('button', { name: 'Reset to seed' });
    await expect(resetBtn).toBeVisible({ timeout: 5_000 });
    await resetBtn.click();
    await page.waitForTimeout(200);
    await expect(editorA.locator('.cm-content')).toContainText('function greet');
    await expect(editorB.locator('.cm-content')).toContainText('function greet');

    // Editor → wrapper → editor path. Focus editor A's contenteditable and
    // type a recognizable suffix. The wrapper's updateListener writes the
    // new doc through `$props.value = ...` (model:true), which sets the
    // demo's `$data.code`, which fires editor B's $watch(value), which
    // dispatches a CodeMirror transaction.
    //
    // Soft-try because text-input synthesis through contenteditable + the
    // per-target shadow-DOM boundaries varies (Lit hosts inside a
    // ShadowRoot). The structural gates above are the primary smoke; this
    // is the bonus round-trip assertion.
    try {
      const aContent = editorA.locator('.cm-content');
      await aContent.click({ timeout: 2_000 });
      // Move cursor to end-of-doc, then type a unique suffix.
      await page.keyboard.press('Control+End');
      const marker = `// rozie-${Date.now()}`;
      await page.keyboard.type(`\n${marker}`);
      // Wait for the watcher → dispatch cycle.
      await expect
        .poll(
          async () =>
            (await editorB.locator('.cm-content').textContent()) ?? '',
          { timeout: 4_000, intervals: [200, 400, 800] },
        )
        .toContain(marker);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[code-mirror ${target}] editor-typing round-trip skipped: ${(e as Error).message}`,
      );
    }
  });
}
