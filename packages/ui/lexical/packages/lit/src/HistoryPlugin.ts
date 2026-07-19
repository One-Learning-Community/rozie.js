import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';
// registerHistory installs the undo/redo update listener + command handlers;
// createEmptyHistoryState seeds a fresh (empty) undo/redo stack. Ordinary named
// imports — neither is a `$`-API.
import { registerHistory, createEmptyHistoryState } from '@lexical/history';

// The shared editor context object provided by the shell ({ get instance() {…} }).
// `$inject` binds to a `const` (ROZ132), then aliases through a null-`let`
// (typeNeutralize) so `.instance` type-checks on the strict bundled leaves; the alias
// is TOP-LEVEL scope so the hoisted Solid teardown can reach it (see RichTextPlugin
// header for the full rationale).

const __rozieCtx_rozie_lexical_editor = createContext(Symbol.for("rozie:rozie-lexical-editor"));

@customElement('rozie-history-plugin')
export default class HistoryPlugin extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

  /**
   * Coalescing window in milliseconds for the history stack — edits landing within `delay` ms of each other collapse into a single undo step. The `registerHistory` delay argument. Lower values make undo more granular; 0 records every keystroke separately.
   */
  @property({ type: Number, reflect: true }) delay: number = 300;
private __rozieCtxConsumer_rozie_lexical_editor = new ContextConsumer(this, { context: __rozieCtx_rozie_lexical_editor, subscribe: true });
private get editorCtx() { return this.__rozieCtxConsumer_rozie_lexical_editor.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.ctx = this.editorCtx;

    this._disconnectCleanups.push((() => {
      this.disposed = true;
      if (this.teardown) {
        this.teardown();
        this.teardown = null;
      }
    }));

    // Defer one microtask so the parent shell's $onMount has created the editor —
    // child mount hooks fire before the parent's on React/Vue/Solid (see RichTextPlugin
    // header for the full ordering note).
    queueMicrotask(this.activate);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html``;
  }

  ctx: any = null;

  teardown: any = null;

  disposed = false;

  activate = () => {
  if (this.teardown || this.disposed) return;
  const editor = this.ctx && this.ctx.instance;
  if (!editor) return;
  // LISTENER mechanism: registerHistory returns the merged cleanup for its update
  // listener + undo/redo command registrations. A fresh empty history state is fine
  // — the shell seeds the initial (empty) document.
  this.teardown = registerHistory(editor, createEmptyHistoryState(), this.delay);
};
}
