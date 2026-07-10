import { LitElement, css, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { injectGlobalStyles, rozieListeners, rozieSpread } from '@rozie/runtime-lit';

@customElement('rozie-engine-dom-escape')
export default class EngineDomEscape extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-engine-host[data-rozie-s-701c687a] {
  display: block;
  position: relative;
}
.rozie-engine-host .cm-editor {
    height: 100%;
    font-size: 13px;
    color: var(--rozie-engine-accent);
  }
.rozie-engine-host .cm-scroller {
    height: 100%;
    overflow: auto;
  }
`;

  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    // Tiny inline "engine" that appends a `.cm-editor` element the author cannot
    // reach with scoped CSS (no Rozie scope attribute is stamped onto it). The
    // :root { } engine rule is the only mechanism that styles it across targets.
    class MiniEngine {
      constructor(rootEl: any) {
        this.rootEl = rootEl;
        const editor = document.createElement('div');
        editor.className = 'cm-editor';
        const scroller = document.createElement('div');
        scroller.className = 'cm-scroller';
        editor.appendChild(scroller);
        rootEl.appendChild(editor);
        this.editor = editor;
      }
      destroy() {
        if (this.editor) this.editor.remove();
        this.editor = null;
      }
    }

    this._disconnectCleanups.push((() => this.instance?.destroy()));

    this.instance = new MiniEngine(this._ref__rozieRoot);
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
<div class="rozie-engine-host" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="__rozieRoot" data-rozie-s-701c687a></div>
`;
  }

  instance: any = null;

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   */
  private get $attrs(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) out[a.name] = a.value;
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

injectGlobalStyles('rozie-engine-dom-escape-global', `
:root {
  --rozie-engine-accent: #4f46e5;
}
.rozie-engine-host .cm-editor {
    height: 100%;
    font-size: 13px;
    color: var(--rozie-engine-accent);
  }
.rozie-engine-host .cm-scroller {
    height: 100%;
    overflow: auto;
  }
`);
