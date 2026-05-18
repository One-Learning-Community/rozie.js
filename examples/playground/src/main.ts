// monaco-env MUST be imported first so MonacoEnvironment is set before any
// editor is instantiated.
import './monaco-env';

import * as monaco from 'monaco-editor';
import defaultSnippet from './snippets/Sortable.rozie.txt?raw';
import { compileBuffer } from './compile';
import type { CompileTarget } from '@rozie/core';

const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  language: 'plaintext',
  automaticLayout: true,
  minimap: { enabled: false },
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  fontSize: 13,
  tabSize: 2,
};

function bootstrap(): void {
  const editorHost = document.getElementById('editor');
  const outputHost = document.getElementById('output');
  const targetSelect = document.getElementById('target') as HTMLSelectElement | null;

  if (!editorHost || !outputHost || !targetSelect) {
    throw new Error('Playground bootstrap: missing DOM mount points');
  }

  const leftEditor = monaco.editor.create(editorHost, {
    ...EDITOR_OPTIONS,
    value: defaultSnippet,
  });

  const rightEditor = monaco.editor.create(outputHost, {
    ...EDITOR_OPTIONS,
    value: '',
    readOnly: true,
  });

  function runCompile(): void {
    const source = leftEditor.getValue();
    const target = targetSelect!.value as CompileTarget;
    const outcome = compileBuffer(source, target);
    rightEditor.setValue(outcome.ok ? outcome.code : outcome.errorText);
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
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
