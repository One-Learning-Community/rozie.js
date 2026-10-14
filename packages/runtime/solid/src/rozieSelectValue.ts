/**
 * `rozieSelectValue` — keeps a native `<select>`'s selection on a bound value.
 *
 * A `<select value={x()}>` sets `el.value` when `x` changes, but a `<select>`
 * can only select an `<option>` it already holds: options that arrive (or are
 * replaced) after the value was set leave the selection on whatever the browser
 * picked. This re-applies the value whenever the value changes AND whenever the
 * select's options change. Emitted for a `<select :value="…">` binding.
 *
 * @public — runtime API consumed by emitted .tsx files.
 */
import { createRenderEffect, onCleanup, untrack } from 'solid-js';
import { rozieDisplay } from './rozieDisplay.js';

export function rozieSelectValue(el: HTMLSelectElement, value: () => unknown): void {
  const apply = (v: unknown): void => {
    const next = v == null ? '' : rozieDisplay(v);
    if (el.value !== next) el.value = next;
  };
  createRenderEffect(() => apply(value()));
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => apply(untrack(value)));
  observer.observe(el, { childList: true, subtree: true });
  onCleanup(() => observer.disconnect());
}
