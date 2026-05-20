// monaco-env MUST be imported first so MonacoEnvironment is set before any
// editor is instantiated.
import './monaco-env';

import * as monaco from 'monaco-editor';
import {
  ALL_TARGETS,
  compileBundle,
  compileBundleAll,
  compileBundleRuntime,
  compileBundleAllRuntime,
} from './compile';
import { setupTextmate } from './textmate-setup';
import { PreviewManager } from './preview/manager';
import { SNIPPETS, DEFAULT_SNIPPET_KEY, findSnippet, type Snippet } from './snippets';
import { encodeState, decodeState } from './url-state';
import type { CompileTarget } from '@rozie/core';

const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  fontSize: 13,
  tabSize: 2,
  // `rozie-dark` extends vs-dark with scope-name rules that match what the
  // Rozie TextMate grammar actually emits (entity.name.tag, punctuation.*,
  // meta.embedded.expression, etc.) — set by textmate-setup before any editor
  // is created. If textmate setup fails the catch in bootstrap falls the
  // editor back to plain registration; theme stays vs-dark which is fine.
  theme: 'rozie-dark',
};

// Map dropdown target → Monaco built-in language for the right (output) pane.
// react + angular emit .tsx / .ts; vue + svelte emit SFCs which Monaco doesn't
// natively understand but `html` gives a reasonable color baseline.
const OUTPUT_LANGUAGE: Record<CompileTarget, string> = {
  react: 'typescript',
  angular: 'typescript',
  vue: 'html',
  svelte: 'html',
  solid: 'typescript',
  lit: 'typescript',
};

async function bootstrap(): Promise<void> {
  const editorHost = document.getElementById('editor');
  const outputHost = document.getElementById('output');
  const previewHost = document.getElementById('preview-host');
  const previewStatus = document.getElementById('preview-status');
  const targetSelect = document.getElementById('target') as HTMLSelectElement | null;
  const snippetSelect = document.getElementById('snippet') as HTMLSelectElement | null;
  const tabButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#right-tabs .tab-btn'),
  );

  if (!editorHost || !outputHost || !targetSelect || !snippetSelect || !previewHost || !previewStatus) {
    throw new Error('Playground bootstrap: missing DOM mount points');
  }

  // Restore editor state from the URL hash (#<deflate-raw + base64url state>).
  // A shared link or a post-refresh reload carries the snippet, target, and
  // live buffer; absent a hash this is null and we fall back to the default.
  const restored =
    location.hash.length > 1 ? await decodeState(location.hash.slice(1)) : null;

  // Populate the snippet picker — group spike + bundle + examples + demos by
  // their key prefix (the leading "spike/", "bundle/", "demos/", or none) so
  // the dropdown organizes cleanly without us hand-categorizing.
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const snippet of SNIPPETS) {
    const slash = snippet.key.indexOf('/');
    const groupName = slash > -1 ? snippet.key.slice(0, slash) : 'examples';
    let group = groups.get(groupName);
    if (!group) {
      group = document.createElement('optgroup');
      group.label = groupName;
      snippetSelect.appendChild(group);
      groups.set(groupName, group);
    }
    const opt = document.createElement('option');
    opt.value = snippet.key;
    opt.textContent = slash > -1 ? snippet.key.slice(slash + 1) : snippet.key;
    if (snippet.key === DEFAULT_SNIPPET_KEY) opt.selected = true;
    group.appendChild(opt);
  }

  // A restored link overrides the default selections — reflect its snippet
  // and target in the pickers before the editor + first compile read them.
  if (restored) {
    if (findSnippet(restored.snippet)) snippetSelect.value = restored.snippet;
    if ((ALL_TARGETS as readonly string[]).includes(restored.target)) {
      targetSelect.value = restored.target;
    }
  }

  // Inject the "Compare all targets" toggle into the toolbar next to the
  // existing target select. This is the entry point for grid mode — when
  // checked, the preview pane lays out all 6 framework outputs side-by-side.
  const modeToggleLabel = document.createElement('label');
  modeToggleLabel.id = 'preview-mode-toggle';
  modeToggleLabel.title = 'Render the current snippet across all 6 targets simultaneously';
  const modeToggleInput = document.createElement('input');
  modeToggleInput.type = 'checkbox';
  modeToggleInput.id = 'preview-mode-toggle-input';
  modeToggleLabel.appendChild(modeToggleInput);
  const modeToggleText = document.createElement('span');
  modeToggleText.textContent = 'Compare all targets';
  modeToggleLabel.appendChild(modeToggleText);
  targetSelect.insertAdjacentElement('afterend', modeToggleLabel);

  const previewManager = new PreviewManager(previewHost, previewStatus);

  // Tab toggling — flip .active on button + matching panel.
  for (const btn of tabButtons) {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (!tab) return;
      for (const b of tabButtons) b.classList.toggle('active', b === btn);
      document.querySelectorAll<HTMLElement>('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === tab);
      });
    });
  }

  // Register the rozie TextMate grammar BEFORE creating the editor so the
  // initial paint is already highlighted.
  try {
    await setupTextmate();
  } catch (e) {
    console.error('[playground] TextMate setup failed; falling back to plaintext for .rozie', e);
    monaco.languages.register({ id: 'rozie', extensions: ['.rozie'] });
  }

  const fallbackSnippet = findSnippet(DEFAULT_SNIPPET_KEY) ?? SNIPPETS[0]!;

  // Resolve what the editor opens with. A restored URL state wins over the
  // default snippet. An unknown restored snippet key (the snippet was removed
  // since the link was made) degrades to a synthetic single-file snippet so
  // the buffer still compiles — just without any bundle siblings.
  let initialSnippet: Snippet;
  let initialCode: string;
  if (restored) {
    initialSnippet =
      findSnippet(restored.snippet) ?? {
        key: restored.snippet,
        label: restored.snippet,
        entry: 'Playground.rozie',
        files: { 'Playground.rozie': restored.code },
      };
    initialCode = restored.code;
  } else {
    initialSnippet = fallbackSnippet;
    initialCode = fallbackSnippet.files[fallbackSnippet.entry] ?? '';
  }

  const leftEditor = monaco.editor.create(editorHost, {
    ...EDITOR_OPTIONS,
    language: 'rozie',
    value: initialCode,
  });

  // Track which snippet the editor is currently displaying — when the user
  // edits, we build an on-the-fly bundle that swaps the entry source for the
  // editor's contents while keeping any sibling files intact. That way an
  // edit to SortableListDemo.rozie still resolves './SortableList.rozie'.
  let currentSnippet: Snippet = initialSnippet;

  snippetSelect.addEventListener('change', () => {
    const next = findSnippet(snippetSelect.value);
    if (!next) return;
    currentSnippet = next;
    leftEditor.setValue(next.files[next.entry] ?? '');
  });

  const initialTarget = targetSelect.value as CompileTarget;
  const rightEditor = monaco.editor.create(outputHost, {
    ...EDITOR_OPTIONS,
    language: OUTPUT_LANGUAGE[initialTarget],
    value: '',
    readOnly: true,
  });

  function buildLiveBundle(): Snippet {
    // Mirror currentSnippet but replace the entry's source with the live
    // editor contents — dependencies are passed through unchanged so an edit
    // to SortableListDemo still finds SortableList in the VFS.
    return {
      ...currentSnippet,
      files: {
        ...currentSnippet.files,
        [currentSnippet.entry]: leftEditor.getValue(),
      },
    };
  }

  function runCompileSingle(): void {
    const bundle = buildLiveBundle();
    const target = targetSelect!.value as CompileTarget;
    // Output pane uses entry-only compileBundle (the displayed code is what
    // the user wrote, not the auto-compiled sibling code).
    const outputOutcome = compileBundle(bundle, target);
    // Preview uses compileBundleRuntime so siblings are available for the
    // harness's per-sibling blob-URL pass.
    const previewOutcome = compileBundleRuntime(bundle, target);

    const nextLang = OUTPUT_LANGUAGE[target];
    const rightModel = rightEditor.getModel();
    if (rightModel && monaco.editor.getModel(rightModel.uri) === rightModel) {
      monaco.editor.setModelLanguage(rightModel, nextLang);
    }

    rightEditor.setValue(outputOutcome.ok ? outputOutcome.code : outputOutcome.errorText);

    if (previewOutcome.ok) {
      previewManager.clearError(target);
      previewManager.render(
        target,
        previewOutcome.entry.code,
        previewOutcome.css,
        previewOutcome.siblings,
      );
    } else {
      previewManager.clear('compile error — see Output tab');
    }
  }

  function runCompileGrid(): void {
    const bundle = buildLiveBundle();
    // Output pane displays the user-authored entry-only compile for the
    // currently-selected target; preview iframes get the full runtime bundle
    // (entry + siblings) per-target.
    const outputOutcomes = compileBundleAll(bundle);
    const previewOutcomes = compileBundleAllRuntime(bundle);
    const renderPayloads = new Map<
      CompileTarget,
      { code: string; css: string; siblings: Record<string, string> }
    >();

    const activeTarget = targetSelect!.value as CompileTarget;
    const activeOutput = outputOutcomes[activeTarget];
    rightEditor.setValue(activeOutput.ok ? activeOutput.code : activeOutput.errorText);

    for (const target of ALL_TARGETS) {
      const outcome = previewOutcomes[target];
      if (outcome.ok) {
        previewManager.clearError(target);
        renderPayloads.set(target, {
          code: outcome.entry.code,
          css: outcome.css,
          siblings: outcome.siblings,
        });
      } else {
        // Per-cell overlay carries the error; the cell keeps its last good
        // render visible underneath so a fresh typo doesn't blank out the demo.
        previewManager.renderError(target, outcome.errorText);
      }
    }
    if (renderPayloads.size > 0) previewManager.renderMany(renderPayloads);
  }

  function runCompile(): void {
    if (previewManager.getMode() === 'grid') runCompileGrid();
    else runCompileSingle();
  }

  // Mirror the live editor state into the URL hash so a refresh keeps
  // unsaved edits and the address bar stays a shareable link. replaceState
  // (not pushState) keeps keystrokes out of the back-button history.
  function syncUrl(): void {
    encodeState({
      snippet: currentSnippet.key,
      target: targetSelect!.value as CompileTarget,
      code: leftEditor.getValue(),
    })
      .then((encoded) => {
        history.replaceState(null, '', '#' + encoded);
      })
      .catch(() => {
        /* encoding failure is non-fatal — the editor keeps working */
      });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  leftEditor.onDidChangeModelContent(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      runCompile();
      syncUrl();
    }, 250);
  });

  // Explicit user dropdown change compiles immediately (no debounce).
  targetSelect.addEventListener('change', () => {
    runCompile();
    syncUrl();
  });
  snippetSelect.addEventListener('change', () => {
    // The snippet-change handler above already updated the editor; debounce
    // path will fire too, but explicit compile makes the initial paint feel
    // responsive on snippet swap.
    runCompile();
    syncUrl();
  });

  modeToggleInput.addEventListener('change', () => {
    previewManager.setMode(modeToggleInput.checked ? 'grid' : 'single');
    runCompile();
  });

  // Populate the right pane on first paint.
  runCompile();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch((e) => {
      console.error('Playground bootstrap failed', e);
    });
  });
} else {
  bootstrap().catch((e) => {
    console.error('Playground bootstrap failed', e);
  });
}
