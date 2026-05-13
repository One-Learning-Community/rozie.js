/**
 * observeRozieSlotCtx — D-LIT-13 scoped-slot context transport for
 * `@rozie/runtime-lit`.
 *
 * Web Components have no native equivalent of scoped slots' params object —
 * Vue's `slotProps`, Svelte's `let:item`, React's render-function arguments,
 * Angular's `*ngTemplateOutlet context`. The Rozie Lit target compiles
 * `<slot name="item" :item="row" :index="i">` to a DOM `<slot>` element with
 * the params payload serialized as JSON in a `data-rozie-params` attribute.
 *
 * Consumers observe that attribute via this helper. The helper:
 *   1. Reads the initial value and parses it via JSON.parse.
 *   2. Calls `onChange(ctx)` with the initial parsed value.
 *   3. Installs a MutationObserver on the slot element filtered to
 *      `data-rozie-params` attribute mutations.
 *   4. On each mutation, re-reads + re-parses + calls `onChange`.
 *   5. Returns an unsubscribe function that disconnects the observer.
 *
 * **Malformed JSON safety (T-06.4-05 mitigation)**: JSON.parse is wrapped in
 * try/catch. If the attribute value is malformed, the previous valid ctx is
 * retained — `onChange` is NOT invoked with stale or invalid data.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */

export function observeRozieSlotCtx<T = unknown>(
  slotEl: HTMLSlotElement,
  onChange: (ctx: T) => void,
): () => void {
  // Helper that reads + parses the attribute. Returns the parsed ctx, or
  // `undefined` when the attribute is missing/malformed (caller can no-op).
  const readCtx = (): T | undefined => {
    const raw = slotEl.getAttribute('data-rozie-params');
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // T-06.4-05 mitigation — malformed JSON silently swallowed; caller
      // does not see a broken update. The previous valid ctx remains in
      // effect (the consumer's last-rendered state).
      return undefined;
    }
  };

  // Initial fire — only when the attribute is present + parses cleanly.
  const initial = readCtx();
  if (initial !== undefined) {
    onChange(initial);
  }

  const observer = new MutationObserver(() => {
    const next = readCtx();
    if (next !== undefined) {
      onChange(next);
    }
  });
  observer.observe(slotEl, {
    attributes: true,
    attributeFilter: ['data-rozie-params'],
  });

  return (): void => {
    observer.disconnect();
  };
}
