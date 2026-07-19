import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ContextConsumer, createContext } from '@lit/context';
// NAMESPACE imports (D-05): both the `$`-API selection reads AND the command
// constants come through namespace bindings, so no bare `$`-identifier ever reaches
// the Svelte compiler (spike 013 / compile-lexical-check.mjs).
import * as lexical from 'lexical';
import * as lexicalList from '@lexical/list';
import * as lexicalLink from '@lexical/link';
import * as lexicalUtils from '@lexical/utils';

// The shared editor context object provided by the shell ({ get instance() {…} },
// spike 010 late-binding getter). `$inject` binds to a `const` (ROZ132), then aliases
// through a null-`let` (typeNeutralize) so `.instance` type-checks on the strict
// bundled leaves; TOP-LEVEL scope so the hoisted Solid teardown can reach it (see
// RichTextPlugin header for the full rationale).

const __rozieCtx_rozie_lexical_editor = createContext(Symbol.for("rozie:rozie-lexical-editor"));

@customElement('rozie-toolbar')
export default class Toolbar extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-lexical-toolbar[data-rozie-s-cf3602a2] {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  margin-bottom: 0.375rem;
}
.rozie-lexical-toolbar-btn[data-rozie-s-cf3602a2] {
  padding: 0.25rem 0.5rem;
  min-width: 1.75rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.rozie-lexical-toolbar-btn[data-rozie-s-cf3602a2]:hover {
  background: rgba(0, 0, 0, 0.05);
}
.rozie-lexical-toolbar-btn.active[data-rozie-s-cf3602a2] {
  background: #1a1a1a;
  color: #ffffff;
  border-color: #1a1a1a;
}
`;

  private _active = signal({
  bold: false,
  italic: false,
  link: false,
  list: false
});
private __rozieCtxConsumer_rozie_lexical_editor = new ContextConsumer(this, { context: __rozieCtx_rozie_lexical_editor, subscribe: true });
private get editorCtx() { return this.__rozieCtxConsumer_rozie_lexical_editor.value; }

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    this.ctx = this.editorCtx;

    // The registerUpdateListener cleanup, captured once we register. null = not yet /
    // torn down. `disposed` guards the deferred activation against an unmount that races
    // ahead of the microtask below.

    this._disconnectCleanups.push((() => {
      this.disposed = true;
      if (this.teardown) {
        this.teardown();
        this.teardown = null;
      }
    }));

    // Defer one microtask so the parent shell's $onMount has created the editor —
    // child mount hooks fire before the parent's on React/Vue/Solid (see header).
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
    return html`
<div class="rozie-lexical-toolbar" role="toolbar" aria-label="Text formatting" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-cf3602a2>
  <button class="${Object.entries({ "rozie-lexical-toolbar-btn": true, active: this._active.value.bold }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-pressed=${!!this._active.value.bold} aria-label="Bold" @mousedown=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { $event.preventDefault(); }} @click=${this.formatBold} data-rozie-s-cf3602a2><strong data-rozie-s-cf3602a2>B</strong></button>
  <button class="${Object.entries({ "rozie-lexical-toolbar-btn": true, active: this._active.value.italic }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-pressed=${!!this._active.value.italic} aria-label="Italic" @mousedown=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { $event.preventDefault(); }} @click=${this.formatItalic} data-rozie-s-cf3602a2><em data-rozie-s-cf3602a2>I</em></button>
  <button class="${Object.entries({ "rozie-lexical-toolbar-btn": true, active: this._active.value.link }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-pressed=${!!this._active.value.link} aria-label="Link" @mousedown=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { $event.preventDefault(); }} @click=${this.toggleLink} data-rozie-s-cf3602a2>Link</button>
  <button class="${Object.entries({ "rozie-lexical-toolbar-btn": true, active: this._active.value.list }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-pressed=${!!this._active.value.list} aria-label="Bullet list" @mousedown=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { $event.preventDefault(); }} @click=${this.insertList} data-rozie-s-cf3602a2>&bull; List</button>
</div>
`;
  }

  ctx: any = null;

  teardown: any = null;

  disposed = false;

  refreshActive = () => {
  const sel = lexical.$getSelection();
  if (!lexical.$isRangeSelection(sel)) {
    this._active.value = {
      bold: false,
      italic: false,
      link: false,
      list: false
    };
    return;
  }
  const anchorNode = sel.anchor.getNode();
  // Ancestor-type reads via the namespace `$`-API: a ListNode / LinkNode anywhere
  // above the caret means the current selection is inside a list / link.
  const listNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalList.ListNode);
  const linkNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalLink.LinkNode);
  this._active.value = {
    bold: sel.hasFormat('bold'),
    italic: sel.hasFormat('italic'),
    link: linkNode !== null,
    list: listNode !== null
  };
};

  activate = () => {
  if (this.teardown || this.disposed) return;
  const editor = this.ctx && this.ctx.instance;
  if (!editor) return;
  // READ side: on every editor update, read the current selection and reflect it into
  // $data.active so each button's active styling tracks the caret live. registerUpdateListener
  // returns its own cleanup.
  this.teardown = editor.registerUpdateListener(({
    editorState
  }: any) => {
    editorState.read(() => {
      this.refreshActive();
    });
  });
  // Seed the initial state so the buttons render correct active styling before the
  // first user-driven update fires.
  editor.getEditorState().read(() => {
    this.refreshActive();
  });
};

  formatBold = () => {
  const editor = this.ctx && this.ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'bold');
};

  formatItalic = () => {
  const editor = this.ctx && this.ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'italic');
};

  insertList = () => {
  const editor = this.ctx && this.ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexicalList.INSERT_UNORDERED_LIST_COMMAND, undefined);
};

  toggleLink = () => {
  const editor = this.ctx && this.ctx.instance;
  if (!editor) return;
  editor.dispatchCommand(lexicalLink.TOGGLE_LINK_COMMAND, this._active.value.link ? null : 'https://example.com');
};

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
