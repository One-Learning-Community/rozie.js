import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';
// registerList installs the list node-transforms + insert/remove list command
// handlers (INSERT_UNORDERED_LIST_COMMAND / INSERT_ORDERED_LIST_COMMAND /
// REMOVE_LIST_COMMAND). Ordinary named import — not a `$`-API.
import { registerList } from '@lexical/list';

// The shared editor context object provided by the shell. `$inject` binds to a
// `const` (ROZ132), then aliases through a null-`let` (typeNeutralize) so `.instance`
// type-checks on the strict bundled leaves; TOP-LEVEL scope so the hoisted Solid
// teardown can reach it (see RichTextPlugin header for the full rationale).

const __rozieCtx_rozie_lexical_editor = createContext(Symbol.for("rozie:rozie-lexical-editor"));

@customElement('rozie-list-plugin')
export default class ListPlugin extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
`;

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
  // NODE-TRANSFORM mechanism: registerList returns the merged cleanup for its
  // ListNode/ListItemNode transforms + list command registrations.
  this.teardown = registerList(editor);
};
}
