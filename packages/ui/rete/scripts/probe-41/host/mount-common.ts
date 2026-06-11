/*
 * Phase 41 Wave-0 De-Risk Probe — shared mount helpers.
 *
 * Throwaway harness: mounts the compiled ProbeConsumer leaf for one target and
 * exposes the consumer's $expose handle on `window.__probe` so the Playwright
 * driver can fire the 60x drag-frequency stress deterministically.
 */
export function mountTarget(): HTMLElement {
  let el = document.querySelector('[data-testid="probe-mount"]') as HTMLElement | null;
  if (!el) {
    el = document.createElement('div');
    el.setAttribute('data-testid', 'probe-mount');
    document.body.appendChild(el);
  }
  return el;
}

declare global {
  interface Window {
    __probe?: { stress?: () => void };
  }
}
