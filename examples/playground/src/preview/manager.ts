// Per-target iframe lifecycle + parent ↔ harness postMessage protocol.
//
// Each target gets its own iframe, lazy-created on first `render(target, ...)`
// call and kept alive afterward. Switching targets just toggles visibility —
// no harness reload — so framework runtime + esbuild-wasm only initialize
// once per session per target.
//
// Protocol (parent → iframe): { type: 'render', code: string, css: string }
// Protocol (iframe → parent): { type: 'ready' } | { type: 'rendered' } |
//                             { type: 'error', message: string }

import type { CompileTarget } from '@rozie/core';

interface RenderPayload {
  code: string;
  css: string;
}

interface IframeEntry {
  iframe: HTMLIFrameElement;
  ready: Promise<void>;
  pending: RenderPayload | null; // queued payload if iframe not ready yet
}

export class PreviewManager {
  private hostEl: HTMLElement;
  private statusEl: HTMLElement;
  private iframes = new Map<CompileTarget, IframeEntry>();
  private activeTarget: CompileTarget | null = null;

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
        this.setStatus('rendered', false);
      } else if (data.type === 'error') {
        this.setStatus(data.message || 'render error', true);
      } else if (data.type === 'ready') {
        // Ready messages are handled per-iframe via the entry.ready promise
      }
    });
  }

  /**
   * Render `code` (+ optional `css` sidecar) for `target` in its iframe.
   * Creates the iframe on first call for a target; subsequent calls reuse it.
   * Hides all other iframes.
   */
  render(target: CompileTarget, code: string, css: string): void {
    let entry = this.iframes.get(target);
    if (!entry) entry = this.createIframe(target);

    // Toggle visibility — only the active target's iframe is `display: block`.
    if (this.activeTarget !== target) {
      for (const [t, e] of this.iframes) {
        e.iframe.classList.toggle('active', t === target);
      }
      this.activeTarget = target;
    }

    this.setStatus('compiling…', false);

    // If the iframe hasn't reported ready yet, queue the payload.
    entry.pending = { code, css };
    entry.ready.then(() => {
      if (!entry) return;
      // If a newer render arrived while waiting, the pending field will have
      // been overwritten; flush the latest.
      const toSend = entry.pending;
      entry.pending = null;
      if (toSend === null) return;
      entry.iframe.contentWindow?.postMessage(
        { type: 'render', code: toSend.code, css: toSend.css },
        '*',
      );
    });
  }

  /**
   * Clear the preview pane (called when output is an error rather than code).
   */
  clear(message: string): void {
    this.setStatus(message, true);
    // Don't tear down iframes — they keep their last successful render so
    // toggling output→preview after fixing a typo doesn't lose visual context.
  }

  private createIframe(target: CompileTarget): IframeEntry {
    const iframe = document.createElement('iframe');
    iframe.src = `/preview/${target}.html`;
    // `allow-same-origin` is needed so the harness can fetch its sibling
    // `_shared.js` ESM module (otherwise null-origin sandbox CORS-blocks it).
    // This is an internal dev tool with no auth surface — the looser sandbox
    // is acceptable.
    iframe.setAttribute('sandbox', 'allow-scripts allow-modals allow-same-origin');
    iframe.dataset.target = target;
    this.hostEl.appendChild(iframe);

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

    const entry: IframeEntry = { iframe, ready, pending: null };
    this.iframes.set(target, entry);
    return entry;
  }

  private setStatus(text: string, isError: boolean): void {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('error', isError);
  }
}
