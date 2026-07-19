import { LitElement, css, html } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { injectGlobalStyles, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { ContextProvider, createContext } from '@lit/context';
// D-05 / REQ-37: the namespace-import form is the ONLY cross-target-safe way to
// use Lexical's `$`-prefixed API. Every `$`-call below is `lexical.$…` (a property
// access), never a bare `$`-identifier — that is what keeps the emitted Svelte
// clean of `dollar_prefix_invalid`.
import * as lexical from 'lexical';
// Non-`$` helpers use ordinary named imports (unaffected by the Svelte reservation).
import { registerRichText, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
// The reference @mention DecoratorNode (D-07) + the per-target mount bridge
// (D-06/REQ-39). BOTH are VENDORED by codegen into every leaf: `./MentionNode`
// resolves to the shared neutral node, and `./mountDecorators` resolves to the
// leaf's target-matched hand-written bridge (one import specifier, 5 different
// vendored files). Only the non-`$` `MentionNode` CLASS + `mountDecorators` fn are
// imported here — never a `$`-prefixed named import (that would trip Svelte's
// dollar_prefix_invalid, D-05).
import { MentionNode } from './MentionNode';
import { mountDecorators } from './mountDecorators';

// The live editor instance — null before mount / after teardown. Declared at
// TOP-LEVEL script scope (NOT inside $onMount) so it is reachable from BOTH the
// $provide getter below AND the Solid-split onCleanup teardown, which the Solid
// emitter hoists OUTSIDE the mount-body IIFE (the ADDING-A-FAMILY cross-phase-scope
// gotcha — a mount-local `let` would be TS2304 in the teardown).

const __rozieCtx_rozie_lexical_editor = createContext(Symbol.for("rozie:rozie-lexical-editor"));

@customElement('rozie-lexical-editor')
export default class LexicalEditor extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-lexical[data-rozie-s-f679124a] {
  display: block;
}
.rozie-lexical-content[data-rozie-s-f679124a] {
  min-height: 6rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  outline: none;
  font: inherit;
}
.rozie-lexical-content[data-rozie-s-f679124a]:focus {
  border-color: #4f46e5;
}
.rozie-lexical-content strong {
    font-weight: 700;
  }
.rozie-lexical-content em {
    font-style: italic;
  }
.rozie-lexical-content ul {
    margin: 0.25rem 0;
    padding-left: 1.5rem;
  }
.rozie-lexical-content ol {
    margin: 0.25rem 0;
    padding-left: 1.5rem;
  }
.rozie-lexical-content h1 {
    font-size: 1.5rem;
    margin: 0.5rem 0 0.375rem;
  }
.rozie-lexical-content h2 {
    font-size: 1.25rem;
    margin: 0.5rem 0 0.375rem;
  }
`;

  /**
   * Extra Lexical node classes to register at editor creation. Lexical requires every node class to be declared up front, so consumer node extensions are passed here and composed after the built-in RichText/List/Link + `@mention` `MentionNode` set (the reference DecoratorNode is registered by the shell itself; these consumer nodes are composed last so they win).
   */
  @property({ type: Array }) nodes: any[] = [];
  /**
   * The Lexical editor `namespace` (scopes clipboard/collaboration). Falls back to `rozie-lexical` when left empty.
   */
  @property({ type: String, reflect: true }) namespace: string = '';
  /**
   * Accessible name (`aria-label`) applied to the contenteditable host. Omitted from the DOM when unset — supply one for a labelled editing region.
   */
  @property({ type: String, reflect: true }) ariaLabel: string | null = null;
  /**
   * Lexical `theme` object mapping node/format types to CSS class names. The styling hook for this deliberately-unstyled primitive (D-12) — bring your own design-system classes.
   */
  @property({ type: Object }) theme: any = {};
  @query('[data-rozie-ref="rootEl"]') private _refRootEl!: HTMLElement;
private __rozieCtxProvider_rozie_lexical_editor = new ContextProvider(this, { context: __rozieCtx_rozie_lexical_editor, initialValue: ((__rozieCtxHost) => ({
  get instance() {
    return __rozieCtxHost.editor;
  }
}))(this) });

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push((() => {
      cleanup();
      this.editor = null;
    }));

    this.editor = lexical.createEditor({
      namespace: this.namespace || 'rozie-lexical',
      // The full v1.0 node CLASS set is declared here (Lexical requires all node
      // classes up front); consumer `nodes` are composed LAST so they win.
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, MentionNode, ...this.nodes],
      // Fail-loud: rethrow rather than swallow editor-state corruption (T-76-01).
      onError: (e: any) => {
        throw e;
      },
      theme: this.theme
    });

    // Bind the editor to the authored contenteditable host.
    // Bind the editor to the authored contenteditable host.
    this.editor.setRootElement(this._refRootEl);

    // Register the RichText baseline AND wire the per-target @mention decorator bridge
    // (D-06): mountDecorators returns an unregister fn, folded into the same
    // mergeRegister so the decorator listener tears down with everything else. Plugin
    // components (wave 2) add History/List/Link BEHAVIOR against the same $injected
    // editor. mountDecorators runs AFTER setRootElement so getElementByKey resolves.
    // Register the RichText baseline AND wire the per-target @mention decorator bridge
    // (D-06): mountDecorators returns an unregister fn, folded into the same
    // mergeRegister so the decorator listener tears down with everything else. Plugin
    // components (wave 2) add History/List/Link BEHAVIOR against the same $injected
    // editor. mountDecorators runs AFTER setRootElement so getElementByKey resolves.
    const cleanup = mergeRegister(registerRichText(this.editor), mountDecorators(this.editor));

    // Seed an empty paragraph so the caret has a block to land in when the document
    // is empty (the spike 015 seed pattern, in the `lexical.$…` namespace form).
    // Seed an empty paragraph so the caret has a block to land in when the document
    // is empty (the spike 015 seed pattern, in the `lexical.$…` namespace form).
    this.editor.update(() => {
      const root = lexical.$getRoot();
      if (root.getFirstChild() === null) {
        const paragraph = lexical.$createParagraphNode();
        root.append(paragraph);
      }
    });

    // Teardown colocated in the $onMount return (D-04): unregister everything, then
    // null the instance so a late teardown read sees a defined value.
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
<div class="rozie-lexical" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-f679124a>
  
  <div class="rozie-lexical-content" contenteditable=${true} aria-label=${this.ariaLabel} data-rozie-ref="rootEl" data-rozie-s-f679124a></div>
  
  <slot></slot>
</div>
`;
  }

  editor: any = null;

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
    const __skip = new Set<string>(['data-rozie-ref', 'nodes', 'namespace', 'aria-label', 'arialabel', 'theme']);
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

injectGlobalStyles('rozie-lexical-editor-c1dc68a5-global', `
.rozie-lexical-content strong {
    font-weight: 700;
  }
.rozie-lexical-content em {
    font-style: italic;
  }
.rozie-lexical-content ul {
    margin: 0.25rem 0;
    padding-left: 1.5rem;
  }
.rozie-lexical-content ol {
    margin: 0.25rem 0;
    padding-left: 1.5rem;
  }
.rozie-lexical-content h1 {
    font-size: 1.5rem;
    margin: 0.5rem 0 0.375rem;
  }
.rozie-lexical-content h2 {
    font-size: 1.25rem;
    margin: 0.5rem 0 0.375rem;
  }
`);
