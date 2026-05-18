// Monaco worker bootstrap using the `?worker` import pattern Monaco's docs
// recommend for Vite. Only the base editor worker is registered — both panes
// use the 'plaintext' language, so language-specific workers (TS/CSS/HTML/JSON)
// would add ~1.5MB to the bundle for zero benefit at v1.

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};
