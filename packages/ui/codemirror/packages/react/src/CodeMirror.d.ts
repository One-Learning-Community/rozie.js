import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface CodeMirrorProps {
  /**
   * The two-way document text (`r-model:value`) — the editor's contents as a string. Typing in the editor writes the new text back through the model path (CodeMirror's `updateListener` extension); a consumer write reflects into the live document, echo-guarded so a programmatic set does not ping-pong. As the sole `model: true` prop this **is** the only change channel — there are no events.
   * @example
   * <CodeMirror r-model:value="source" language="javascript" theme="dark" />
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  /**
   * Convenience language. `javascript` loads the bundled `@codemirror/lang-javascript`; any other value falls back to plain text (no syntax highlighting, no throw). Add other languages through `:extensions`. Runtime-updatable via a `langCompartment` reconfigure — switching the prop re-highlights without a remount.
   */
  language?: string;
  /**
   * Editor theme. The built-in strings `light` (the editor default — no theme) or `dark` (the bundled `@codemirror/theme-one-dark`), **or** a CodeMirror `Extension` / `Extension[]` passed straight through (G3) — drop in a theme package or an `EditorView.theme({…})`. A non-string theme is composed via the live `themeCompartment` so it reconfigures with no remount, same as the string forms.
   */
  theme?: unknown;
  /**
   * Make the document read-only. Runtime-updatable via a `readOnlyCompartment` reconfigure (no remount).
   */
  readOnly?: boolean;
  /**
   * Editor height in pixels, applied to the wrapper's host box.
   */
  height?: number;
  /**
   * Placeholder text shown when the document is empty (the bundled `@codemirror/view` `placeholder` extension). An empty string means no placeholder. Runtime-updatable via a `placeholderCompartment` reconfigure.
   */
  placeholder?: string;
  /**
   * Consumer-extensible passthrough — an arbitrary `Extension[]` composed **last** so it wins CodeMirror's last-registered-wins facets. The CodeMirror 6 analog of an options bag: line-wrapping, autocomplete, linting, custom key-bindings, additional languages/themes — anything the curated props do not special-case. Runtime-reconfigurable via an `extensionsCompartment` (no remount when the array changes).
   */
  extensions?: unknown[];
  /**
   * When `true`, swap the thin manual baseline (line numbers + history + default/history keymaps) for CodeMirror 6's batteries-included `basicSetup` bundle — autocomplete, search, bracket matching, code folding, lint gutter, and richer keymaps. The curated props and consumer `:extensions` still compose **after** it, so they continue to win. **Construction-time only:** read once when the editor is built (no compartment), so toggling it at runtime requires a re-mount — set it as a fixed prop, do not flip it live.
   */
  basicSetup?: boolean;
  /**
   * The 1-based line numbers that each get a custom gutter marker rendered by the `gutter` reactive multi-instance portal slot (one portal handle per visible marker). Out-of-range lines are ignored. Runtime-updatable via a `gutterCompartment` reconfigure — changing the array re-marks the lines with no remount. Only meaningful when the `gutter` slot is filled.
   */
  gutterLines?: unknown[];
  /**
   * An array of `{ from, to? }` **0-based document offsets** that each get an inline widget rendered by the `decoration` reactive multi-instance portal slot (one portal handle per visible widget). A point widget is placed at `from`; `to` is passed through in scope for the consumer's awareness. Compute an offset from a line via `view.state.doc.line(n).from`. Runtime-updatable via a `decorationCompartment` reconfigure. Only meaningful when the `decoration` slot is filled.
   */
  decorations?: unknown[];
  renderPanel?: (params: { view: () => void }) => ReactNode;
  renderTopPanel?: (params: { view: () => void }) => ReactNode;
  renderTooltip?: (params: { view: () => void; pos: () => void }) => ReactNode;
  renderGutter?: (params: { line: () => void; view: () => void }) => ReactNode;
  renderDecoration?: (params: { from: () => void; to: () => void; view: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface CodeMirrorHandle {
  getView: (...args: any[]) => any;
  focus: (...args: any[]) => any;
  getValue: (...args: any[]) => any;
  replaceValue: (...args: any[]) => any;
  dispatch: (...args: any[]) => any;
  insertText: (...args: any[]) => any;
  getSelection: (...args: any[]) => any;
  setSelection: (...args: any[]) => any;
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  selectAll: (...args: any[]) => any;
  scrollToPos: (...args: any[]) => any;
}

declare const CodeMirror: React.ForwardRefExoticComponent<CodeMirrorProps & React.RefAttributes<CodeMirrorHandle>>;
export default CodeMirror;
