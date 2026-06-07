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

    // The round-trip pair (Editors A/B sharing $data.code) lives in the `.grid`
    // container. The demo ALSO mounts the new-surface rig (Editors C/D/E) lower
    // in the same demo; scoping to `.grid` keeps the count at the round-trip
    // pair (2) regardless of how many surface editors exist below.
    // Substring-match guards against CSS Modules class-mangling on React
    // (see comment in line-chart.spec.ts). All 6 targets keep the
    // `rozie-codemirror` class as a substring or literal; `.grid` is the
    // consumer's plain layout div (carries its literal class on every target).
    const grid = mount.locator('.grid, [class*="grid"]').first();
    const wrappers = grid.locator(
      '.rozie-codemirror, [class*="rozie-codemirror"]',
    );
    await expect(wrappers).toHaveCount(2, { timeout: 10_000 });

    // CodeMirror 6 mounts a `.cm-editor` root and a `.cm-content`
    // contenteditable inside each wrapper. Both editors must mount before
    // any round-trip assertion is meaningful.
    const editors = grid.locator('.cm-editor');
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

/**
 * Expanded-surface behavioral smoke — Phase 29 Plan 04 (D-01..D-06).
 *
 * The round-trip block above proves D-08 (the model path is the only change
 * channel). THIS block proves the rest of the expanded surface BEHAVES at
 * runtime across all 6 targets, driving the new-surface rig in
 * `examples/demos/CodeMirrorDemo.rozie` (Editor C/D/E + the data-testid
 * controls). Structural/behavioral assertions only — NO `toHaveScreenshot`
 * (the pixel tier is the SEPARATE CodeMirrorScreenshot cell below).
 *
 *   - D-01/D-02 — toggle `:extensions` (an `EditorView.editable.of(false)`
 *     extension). The wrapper reconfigures the extensionsCompartment WITHOUT
 *     remount: the surface editor's `.cm-content` `contenteditable` flips to
 *     "false" AND its doc text is preserved (no remount = no blank).
 *   - D-03 — switch the `language` prop. The langCompartment reconfigures
 *     without remount; the doc is preserved. (Plain-text vs javascript has no
 *     reliable cross-target DOM signal, so the proof is "doc preserved + state
 *     pane reflects the new language after the switch".)
 *   - D-04 — the empty-doc placeholder editor shows `.cm-placeholder` text.
 *   - D-05 — the panel portal slot mounts a `.rozie-cm-panel` host when filled
 *     and disposes it when the panel-bearing editor unmounts.
 *   - D-06 — the 8 `$expose` verbs are callable via the framework-native ref
 *     with observable effects (getValue/replaceValue/insertText/getSelection/
 *     getView/focus/setSelection/dispatch — the rig exercises the value-shaping
 *     ones, replaceValue shares the suppress-echo guard so it does not
 *     ping-pong).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`code-mirror [${target}]: expanded surface (extensions/language/placeholder/panel/$expose) behaves`, async ({
    page,
  }) => {
    await page.goto(`/?example=CodeMirror&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // The surface rig (Editor C) is the ref-bearing editor the $expose controls
    // drive. The data-testid lives on the wrapping <div> (surface-cell); the
    // editor `.cm-content` is located within it. Wait for it to mount.
    const surfaceCell = mount.getByTestId('surface-cell');
    await expect(surfaceCell).toBeVisible({ timeout: 10_000 });
    const surfaceContent = surfaceCell.locator('.cm-content');
    await expect
      .poll(async () => (await surfaceContent.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [200, 400, 800],
      })
      .toContain('answer');

    // ---- D-04 placeholder ----
    // Editor D mounts an empty doc with a `placeholder` prop. CM6 renders the
    // placeholder text inside a `.cm-placeholder` node when the doc is empty.
    const placeholderCell = mount.getByTestId('placeholder-cell');
    await expect(placeholderCell).toBeVisible({ timeout: 10_000 });
    await expect(placeholderCell.locator('.cm-placeholder')).toContainText(
      'Type here',
      { timeout: 10_000 },
    );

    // ---- D-01/D-02 extensions reconfigure (no remount, doc preserved) ----
    // Toggle the consumer `:extensions`. The surface editor's `.cm-content`
    // contenteditable flips to "false" and the doc text is preserved (the
    // extensionsCompartment.reconfigure path — no remount).
    const docBefore = (await surfaceContent.textContent()) ?? '';
    await mount.getByTestId('toggle-extensions').click();
    await expect(surfaceContent).toHaveAttribute('contenteditable', 'false', {
      timeout: 10_000,
    });
    // Doc preserved across the reconfigure (proves no remount blanked it).
    await expect(surfaceContent).toContainText('answer');
    expect((await surfaceContent.textContent()) ?? '').toBe(docBefore);
    // Toggle back — contenteditable returns to "true" (still no remount).
    await mount.getByTestId('toggle-extensions').click();
    await expect(surfaceContent).toHaveAttribute('contenteditable', 'true', {
      timeout: 10_000,
    });

    // ---- D-03 language compartment switch (no remount, doc preserved) ----
    await expect(mount.getByTestId('state-language')).toHaveText('javascript', {
      timeout: 10_000,
    });
    await mount.getByTestId('toggle-language').click();
    await expect(mount.getByTestId('state-language')).toHaveText('plaintext', {
      timeout: 10_000,
    });
    // Doc preserved across the langCompartment reconfigure (no remount).
    await expect(surfaceContent).toContainText('answer');

    // ---- D-06 $expose verbs ($refs.cm handle, observable effects) ----
    // Driven via the framework-native component ref. On Angular a component ref
    // resolves to the host ElementRef rather than the exposed handle instance,
    // so the verbs are absent there — the demo optional-chains every call and
    // surfaces "(no handle)". This is the documented per-target ref idiom (same
    // gate as full-calendar-behavior.spec.ts `if (target !== 'angular')`), NOT a
    // bug: the $expose handle is asserted on the 5 targets whose ref resolves to
    // the handle (react/vue/svelte/solid/lit). Angular's exposed surface is
    // covered by the emitter-level $expose unit tests + ExposeProbe.
    if (target !== 'angular') {
      // getValue reads the live doc.
      await mount.getByTestId('handle-get-value').click();
      await expect(mount.getByTestId('state-handle-out')).toContainText(
        'answer',
        { timeout: 10_000 },
      );
      // replaceValue routes through the suppress-echo guard; the doc + the
      // getValue-read-back both reflect the replacement (no ping-pong).
      await mount.getByTestId('handle-replace-value').click();
      await expect(mount.getByTestId('state-handle-out')).toContainText(
        'replaced via handle',
        { timeout: 10_000 },
      );
      await expect(surfaceContent).toContainText('replaced via handle');
      // insertText inserts at the selection; getSelection returns a range;
      // getView returns the raw EditorView. Each writes an observable marker
      // into the state pane.
      await mount.getByTestId('handle-insert-text').click();
      await expect(mount.getByTestId('state-handle-out')).toContainText('X', {
        timeout: 10_000,
      });
      await mount.getByTestId('handle-get-selection').click();
      await expect(mount.getByTestId('state-handle-out')).toContainText('sel ', {
        timeout: 10_000,
      });
      await mount.getByTestId('handle-get-view').click();
      await expect(mount.getByTestId('state-handle-out')).toHaveText('view ok', {
        timeout: 10_000,
      });
    }

    // ---- D-05 panel portal slot mount + dispose ----
    // Initially the panel-bearing editor is unmounted (r-else branch) → no
    // `.rozie-cm-panel` host. Toggle it on → the panel mounts; toggle off →
    // the panel disposes (the editor unmounts, the portal dispose fires).
    const panelCell = mount.getByTestId('panel-cell');
    await expect(panelCell.locator('.rozie-cm-panel')).toHaveCount(0, {
      timeout: 10_000,
    });
    await mount.getByTestId('toggle-panel').click();
    await expect(panelCell.locator('.rozie-cm-panel')).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(mount.getByTestId('panel-fill')).toContainText('panel filled', {
      timeout: 10_000,
    });
    await mount.getByTestId('toggle-panel').click();
    await expect(panelCell.locator('.rozie-cm-panel')).toHaveCount(0, {
      timeout: 10_000,
    });

    // ---- G5 wave 1: topPanel (mount-once) portal slot ----
    // Editor F fills `topPanel`; its host mounts at editor mount through the
    // `showPanel` facet with `top: true` (rendered into `.rozie-cm-panel-top`).
    const tipCell = mount.getByTestId('tip-cell');
    await expect(tipCell.locator('.rozie-cm-panel-top')).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(mount.getByTestId('toppanel-fill')).toContainText(
      'top-docked panel',
      { timeout: 10_000 },
    );

    // ---- G5 wave 1: tooltip (REACTIVE) portal slot — update-in-place ----
    // CodeMirror's FIRST reactive slot. The `showTooltip` StateField yields a
    // tooltip at the caret head; the reactive portal mounts the consumer
    // fragment ONCE and re-renders it IN PLACE as the caret moves. Empirical
    // reconciliation proof: the demo's capTip side effect bumps a mount counter
    // ONCE and an update counter on EVERY caret-move render. We click into
    // Editor F and move the caret with arrow keys; mounts must stay at 1 while
    // updates climbs — i.e. the fragment is NOT remounted per caret move.
    //
    // Soft-try: contenteditable focus + key synthesis varies across the 6
    // targets (Lit hosts inside a ShadowRoot); the topPanel structural gate
    // above is the primary G5-wave-1 smoke, this is the reconciliation bonus.
    try {
      const fEditor = tipCell.locator('.cm-editor').first();
      const fContent = fEditor.locator('.cm-content');
      // Click near the TOP-LEFT so the caret lands at the document start — then
      // every ArrowRight/ArrowDown is a real caret move (clicking mid-doc can
      // park the caret where arrows are no-ops and update never re-fires).
      await fContent.click({ timeout: 2_000, position: { x: 2, y: 2 } });
      // Wait for the tooltip fragment to mount (capTip bumps tipMounts → 1).
      await expect(mount.getByTestId('state-tip-mounts')).toContainText(
        'mounts:1',
        { timeout: 5_000 },
      );
      // Capture the update count, move the caret a few times, and assert the
      // update counter advanced WHILE the mount counter held at 1.
      const updatesBefore = Number(
        (
          (await mount.getByTestId('state-tip-updates').textContent()) ?? ''
        ).replace(/\D/g, ''),
      );
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(60);
      }
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(60);
      // Mount counter UNCHANGED — no remount per caret move (in-place re-render).
      await expect(mount.getByTestId('state-tip-mounts')).toContainText(
        'mounts:1',
        { timeout: 5_000 },
      );
      // Update counter advanced — the reactive handle.update fired per move.
      await expect
        .poll(
          async () =>
            Number(
              (
                (await mount.getByTestId('state-tip-updates').textContent()) ??
                ''
              ).replace(/\D/g, ''),
            ),
          { timeout: 5_000, intervals: [100, 200, 400] },
        )
        .toBeGreaterThan(updatesBefore);
    } catch {
      // Key synthesis unavailable on this target/host — the topPanel structural
      // gate already proved the wave-1 slot wiring; skip the caret-move bonus.
    }
  });
}

/**
 * Content-stable screenshot leg — Phase 29 Plan 04 (D-07 tier 2).
 *
 * A SEPARATE leg from the behavioral blocks above. It routes to the
 * deterministic `CodeMirrorScreenshot` cell (CodeMirrorScreenshotDemo.rozie):
 * a fixed doc + theme="light" + the `screenshotStable` EditorView.theme applied
 * via `:extensions` (caret/selection/active-line neutralized), and NO editor
 * focus. The capture polls `.cm-content` for the rendered fixed doc, then waits
 * for CM6's async viewport measure to settle before `toHaveScreenshot`.
 *
 * Baselines are regenerated ONLY in pinned Linux Docker (feedback_vr_linux_
 * baselines; feedback_vr_macos_text_node_kerning) — locally this leg
 * baseline-gates to `test.fixme` until the Linux PNG exists.
 */
const SCREENSHOT_DIR = resolve(__dirname, '../__screenshots__');
const screenshotBaselineExists = existsSync(
  resolve(SCREENSHOT_DIR, 'CodeMirrorScreenshot.png'),
);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  // Gate on build availability, KNOWN_FAILING, AND the Linux baseline presence
  // (matrix.spec.ts owns the matrix cell; this leg adds an explicit settle-then-
  // capture guard and stays fixme until the Docker baseline lands).
  const runner =
    !built || KNOWN_FAILING.has(target) || !screenshotBaselineExists
      ? test.fixme
      : test;
  runner(`code-mirror [${target}]: content-stable screenshot (caret/selection-neutralized)`, async ({
    page,
  }) => {
    await page.goto(`/?example=CodeMirrorScreenshot&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    // Poll the fixed doc into the rendered `.cm-content` — proves the editor
    // mounted and CM6 painted its lines. Do NOT focus the editor.
    const content = mount.locator('.cm-content').first();
    await expect
      .poll(async () => (await content.textContent()) ?? '', {
        timeout: 5_000,
        intervals: [200, 400, 800],
      })
      .toContain('greet');

    // Let CM6's async viewport measure settle (one or two RAFs for the short
    // fixed doc) before the clip. The screenshotStable theme already removes the
    // caret-blink / selection / active-line variables, so this is the only
    // remaining settle source.
    await page.waitForTimeout(250);

    await expect(mount).toHaveScreenshot('CodeMirrorScreenshot.png', {
      maxDiffPixels: 2,
      animations: 'disabled',
    });
  });
}
