import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';
// NAMESPACE imports (D-05): both the priority constant and the `$`-API come through
// namespace bindings so no bare `$`-identifier ever reaches the Svelte compiler.
import * as lexical from 'lexical';
import * as lexicalLink from '@lexical/link';

// The shared editor context object provided by the shell. `$inject` binds to a
// `const` (ROZ132), then aliases through a null-`let` (typeNeutralize) so `.instance`
// type-checks on the strict bundled leaves; TOP-LEVEL scope so the hoisted Solid
// teardown can reach it (see RichTextPlugin header for the full rationale).

const __rozieCtx_rozie_lexical_editor = createContext(Symbol.for("rozie:rozie-lexical-editor"));

@customElement('rozie-link-plugin')
export default class LinkPlugin extends SignalWatcher(LitElement) {
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
  // COMMAND mechanism: register the TOGGLE_LINK_COMMAND handler. Mirrors
  // @lexical/link's registerLink payload handling (null = unlink, string = url,
  // object = url + link attributes). Runs at EDITOR priority so it wins the
  // toggle before lower-priority handlers. registerCommand returns its own cleanup.
  this.teardown = editor.registerCommand(lexicalLink.TOGGLE_LINK_COMMAND, (payload: any) => {
    if (payload === null) {
      lexicalLink.$toggleLink(null);
      return true;
    } else if (typeof payload === 'string') {
      lexicalLink.$toggleLink(payload);
      return true;
    }
    const {
      url,
      target,
      rel,
      title
    } = payload;
    lexicalLink.$toggleLink(url, {
      rel,
      target,
      title
    });
    return true;
  }, lexical.COMMAND_PRIORITY_EDITOR);
};
}
