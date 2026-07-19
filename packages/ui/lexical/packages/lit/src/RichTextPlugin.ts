import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';
// registerRichText wires the rich-text command set (formatting, paragraph/heading
// behavior, node transforms). Ordinary named import — not a `$`-API.
import { registerRichText } from '@lexical/rich-text';

// The shared editor context object provided by the shell ({ get instance() {…} },
// spike 010 late-binding getter). `$inject` must bind directly to a `const` (ROZ132);
// it is then aliased through a null-`let` (typeNeutralize) so the `.instance` read
// type-checks under the strict bundled-leaf tsc — `$inject` is typed `unknown`
// (Phase 36 D-4), which would reject `.instance` with TS2339. The alias is kept at
// TOP-LEVEL script scope (not mount-local) so the Solid teardown — which the Solid
// emitter hoists into a sibling onCleanup OUTSIDE the mount closure — can reach it
// (the ADDING-A-FAMILY cross-phase-scope idiom, per Layer.rozie).

const __rozieCtx_rozie_lexical_editor = createContext(Symbol.for("rozie:rozie-lexical-editor"));

@customElement('rozie-rich-text-plugin')
export default class RichTextPlugin extends SignalWatcher(LitElement) {
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

    // The register* cleanup, captured once we actually register. null = not yet / torn
    // down. `disposed` guards the deferred activation against an unmount that races ahead
    // of the microtask below.

    this._disconnectCleanups.push((() => {
      this.disposed = true;
      if (this.teardown) {
        this.teardown();
        this.teardown = null;
      }
    }));

    // The shell creates the editor in ITS $onMount. On React/Vue/Solid a CHILD's mount
    // hook runs BEFORE the parent's, so `ctx.instance` is still null at THIS instant.
    // Defer one microtask: by the time it runs, the parent shell's $onMount has
    // completed and the live editor is bound through the getter (the shell's stated
    // "a plugin that mounts AFTER the shell reads the current instance" contract).
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
  // Idempotency marker: never stack a second registerRichText on the same editor
  // (two <RichTextPlugin/> children, or a plugin plus a future re-entry). The shell's
  // own baseline is registered independently in its $onMount; this guard prevents
  // PLUGIN-level duplication and keeps teardown symmetric.
  if (editor.__rozieRichTextRegistered) return;
  editor.__rozieRichTextRegistered = true;
  const cleanup = registerRichText(editor);
  this.teardown = () => {
    cleanup();
    editor.__rozieRichTextRegistered = false;
  };
};
}
