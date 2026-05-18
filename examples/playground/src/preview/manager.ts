// Per-target iframe lifecycle + parent ↔ harness postMessage protocol.
//
// Each target gets its own iframe, lazy-created on first `render(target, ...)`
// call and kept alive afterward. Two display modes:
//
//   - 'single': only the active target's iframe is visible; others
//     `display: none`. Switching targets just toggles `.active` — no
//     harness reload. This is the playground's default mode.
//   - 'grid':   all 6 iframes are laid out in a 3×2 grid simultaneously.
//     Used by the "Compare all targets" toggle so demos render side-by-side.
//     Each iframe is wrapped in a `.preview-cell` div carrying a target
//     label so consumers can tell which output is which at a glance.
//
// Protocol (parent → iframe): { type: 'render', code: string, css: string,
//                                siblings: Record<string, string> }
// Protocol (iframe → parent): { type: 'ready' } | { type: 'rendered' } |
//                             { type: 'error', message: string }
//
// `siblings` is a basename → compiled-source map for multi-file bundle
// snippets. The harness mints a blob URL per sibling and rewrites the entry's
// relative imports before importing it. Empty `{}` for single-file snippets.

import type { CompileTarget } from '@rozie/core';

export type PreviewMode = 'single' | 'grid';

interface RenderPayload {
  code: string;
  css: string;
  siblings?: Record<string, string>;
}

interface IframeEntry {
  /** Wrapper div carrying a `.preview-cell` class — visible in grid mode. */
  cell: HTMLDivElement;
  iframe: HTMLIFrameElement;
  ready: Promise<void>;
  pending: RenderPayload | null; // queued payload if iframe not ready yet
}

export class PreviewManager {
  private hostEl: HTMLElement;
  private statusEl: HTMLElement;
  private iframes = new Map<CompileTarget, IframeEntry>();
  private activeTarget: CompileTarget | null = null;
  private mode: PreviewMode = 'single';

  constructor(hostEl: HTMLElement, statusEl: HTMLElement) {
    this.hostEl = hostEl;
    this.statusEl = statusEl;

    window.addEventListener('message', (e: MessageEvent) => {
      const data = e.data as { type?: string; message?: string };
      if (!data || typeof data.type !== 'string') return;
      // Only react if the message came from one of our iframes — drop noise.
      const fromOurs = Array.from(this.iframes.values()).some(
        (entry) => entry.iframe.contentWindow === e.source,
      );
      if (!fromOurs) return;

      if (data.type === 'rendered') {
        // In grid mode the single status bar can't usefully represent six
        // outcomes — keep it quiet and let any per-iframe error overlay
        // (rendered as a child of the cell) carry the signal.
        if (this.mode === 'single') this.setStatus('rendered', false);
      } else if (data.type === 'error') {
        if (this.mode === 'single') this.setStatus(data.message || 'render error', true);
      } else if (data.type === 'ready') {
        // Ready messages are handled per-iframe via the entry.ready promise
      }
    });
  }

  setMode(mode: PreviewMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.hostEl.classList.toggle('grid-mode', mode === 'grid');
    if (mode === 'grid') {
      // Make sure all cells are visible (no `.active` toggling in grid mode).
      for (const [, entry] of this.iframes) {
        entry.cell.classList.add('grid-visible');
      }
    } else {
      for (const [t, entry] of this.iframes) {
        entry.cell.classList.remove('grid-visible');
        entry.iframe.classList.toggle('active', t === this.activeTarget);
      }
    }
  }

  getMode(): PreviewMode {
    return this.mode;
  }

  /**
   * Render `code` (+ optional `css` sidecar) for `target` in its iframe.
   * Creates the iframe on first call for a target; subsequent calls reuse it.
   * In single mode, hides all other iframes; in grid mode, leaves layout alone.
   *
   * `siblings` is the per-target basename→compiled-source map for bundle
   * snippets — empty `{}` for single-file snippets. The harness mints a blob
   * URL per sibling and rewrites the entry's `./<basename>` imports before
   * dynamic-importing the entry, so esbuild-side `from './SortableList'`
   * specifiers resolve correctly under the iframe's blob: base.
   */
  render(
    target: CompileTarget,
    code: string,
    css: string,
    siblings: Record<string, string> = {},
  ): void {
    let entry = this.iframes.get(target);
    if (!entry) entry = this.createIframe(target);

    if (this.mode === 'single') {
      if (this.activeTarget !== target) {
        for (const [t, e] of this.iframes) {
          e.iframe.classList.toggle('active', t === target);
        }
        this.activeTarget = target;
      }
      this.setStatus('compiling…', false);
    }

    this.queueRender(entry, { code, css, siblings });
  }

  /**
   * Render multiple targets at once — used by grid mode. `payloads` should
   * cover every target the caller wants visible; missing targets keep their
   * last successful render (or remain blank if they were never rendered).
   */
  renderMany(payloads: ReadonlyMap<CompileTarget, RenderPayload>): void {
    for (const [target, payload] of payloads) {
      let entry = this.iframes.get(target);
      if (!entry) entry = this.createIframe(target);
      if (this.mode === 'grid') entry.cell.classList.add('grid-visible');
      this.queueRender(entry, payload);
    }
  }

  /**
   * Surface a per-target error overlay on the cell (visible in grid mode) and
   * keep the iframe's last successful render around. In single mode this also
   * updates the global status bar.
   */
  renderError(target: CompileTarget, message: string): void {
    let entry = this.iframes.get(target);
    if (!entry) entry = this.createIframe(target);
    entry.cell.dataset.errorText = message;
    entry.cell.classList.add('has-error');
    if (this.mode === 'grid') entry.cell.classList.add('grid-visible');
    if (this.mode === 'single' && target === this.activeTarget) {
      this.setStatus(message, true);
    }
  }

  /**
   * Clear any error overlay on `target`. Should be called immediately before
   * a fresh `render(target, ...)` so stale errors don't linger.
   */
  clearError(target: CompileTarget): void {
    const entry = this.iframes.get(target);
    if (!entry) return;
    entry.cell.classList.remove('has-error');
    delete entry.cell.dataset.errorText;
  }

  /**
   * Clear the preview pane status (called when output is an error rather than
   * code). Doesn't tear down iframes — they keep their last successful render
   * so toggling Output → Preview after fixing a typo doesn't lose context.
   */
  clear(message: string): void {
    this.setStatus(message, true);
  }

  private queueRender(entry: IframeEntry, payload: RenderPayload): void {
    entry.pending = payload;
    entry.ready.then(() => {
      const toSend = entry.pending;
      entry.pending = null;
      if (toSend === null) return;
      entry.iframe.contentWindow?.postMessage(
        {
          type: 'render',
          code: toSend.code,
          css: toSend.css,
          siblings: toSend.siblings ?? {},
        },
        '*',
      );
    });
  }

  private createIframe(target: CompileTarget): IframeEntry {
    const cell = document.createElement('div');
    cell.className = 'preview-cell';
    cell.dataset.target = target;

    const label = document.createElement('div');
    label.className = 'preview-cell-label';
    label.textContent = target;
    cell.appendChild(label);

    const iframe = document.createElement('iframe');
    iframe.src = `/preview/${target}.html`;
    // `allow-same-origin` is needed so the harness can fetch its sibling
    // `_shared.js` ESM module (otherwise null-origin sandbox CORS-blocks it).
    // This is an internal dev tool with no auth surface — the looser sandbox
    // is acceptable.
    iframe.setAttribute('sandbox', 'allow-scripts allow-modals allow-same-origin allow-forms');
    iframe.dataset.target = target;
    cell.appendChild(iframe);

    if (this.mode === 'grid') cell.classList.add('grid-visible');

    this.hostEl.appendChild(cell);

    const ready = new Promise<void>((resolve) => {
      const onMsg = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow) return;
        const data = e.data as { type?: string };
        if (data?.type === 'ready') {
          window.removeEventListener('message', onMsg);
          resolve();
        }
      };
      window.addEventListener('message', onMsg);
    });

    const entry: IframeEntry = { cell, iframe, ready, pending: null };
    this.iframes.set(target, entry);
    return entry;
  }

  private setStatus(text: string, isError: boolean): void {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('error', isError);
  }
}
