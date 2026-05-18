// monaco-env MUST be imported first so MonacoEnvironment is set before any
// editor is instantiated.
import './monaco-env';

import * as monaco from 'monaco-editor';
import defaultSnippet from './snippets/Sortable.rozie.txt?raw';
import { compileBuffer } from './compile';
import { setupTextmate } from './textmate-setup';
import { PreviewManager } from './preview/manager';
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
  // Targets the playground dropdown does not currently expose — included so the
  // type is exhaustive against CompileTarget. Safe defaults.
  solid: 'typescript',
  lit: 'typescript',
};

async function bootstrap(): Promise<void> {
  const editorHost = document.getElementById('editor');
  const outputHost = document.getElementById('output');
  const previewHost = document.getElementById('preview-host');
  const previewStatus = document.getElementById('preview-status');
  const targetSelect = document.getElementById('target') as HTMLSelectElement | null;
  const tabButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#right-tabs .tab-btn'),
  );

  if (!editorHost || !outputHost || !targetSelect || !previewHost || !previewStatus) {
    throw new Error('Playground bootstrap: missing DOM mount points');
  }

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
  // initial paint is already highlighted. wireTmGrammars internally calls
  // monaco.languages.setTokensProvider, which any subsequently-created model
  // for that language picks up automatically.
  // Non-fatal: if textmate setup fails (e.g., onigasm WASM load failure), the
  // editor still mounts — just without rozie-aware coloring.
  try {
    await setupTextmate();
  } catch (e) {
    console.error('[playground] TextMate setup failed; falling back to plaintext for .rozie', e);
    monaco.languages.register({ id: 'rozie', extensions: ['.rozie'] });
  }

  const leftEditor = monaco.editor.create(editorHost, {
    ...EDITOR_OPTIONS,
    language: 'rozie',
    value: defaultSnippet,
  });

  const initialTarget = targetSelect.value as CompileTarget;
  const rightEditor = monaco.editor.create(outputHost, {
    ...EDITOR_OPTIONS,
    language: OUTPUT_LANGUAGE[initialTarget],
    value: '',
    readOnly: true,
  });

  function runCompile(): void {
    const source = leftEditor.getValue();
    const target = targetSelect!.value as CompileTarget;
    const outcome = compileBuffer(source, target);

    const nextLang = OUTPUT_LANGUAGE[target];
    const rightModel = rightEditor.getModel();
    if (rightModel && monaco.editor.getModel(rightModel.uri) === rightModel) {
      monaco.editor.setModelLanguage(rightModel, nextLang);
    }

    rightEditor.setValue(outcome.ok ? outcome.code : outcome.errorText);

    if (outcome.ok) {
      previewManager.render(target, outcome.code);
    } else {
      previewManager.clear('compile error — see Output tab');
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  leftEditor.onDidChangeModelContent(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(runCompile, 250);
  });

  // Explicit user dropdown change compiles immediately (no debounce).
  targetSelect.addEventListener('change', runCompile);

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
