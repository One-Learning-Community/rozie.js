import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';

interface FilterTextProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
  setFilter?: ((...args: unknown[]) => unknown) | null;
}

export default function FilterText(_props: FilterTextProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, value: null, setFilter: null }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'value', 'setFilter']);

  const [draft, setDraft] = createSignal('');

  // Seed the draft once at setup from the incoming value (setup-once, NOT in the
  // template). Normalize null/undefined to '' so the input value binds to a string.
  setDraft(local.value != null ? String(local.value) : '');

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  function onInput(e: any) {
    setDraft(e && e.target ? e.target.value : '');
  }

  // setFilter is a Function prop (default null) — guard before calling.
  function applyFilter() {
    local.setFilter && local.setFilter(local.columnId, draft());
  }
  function clearFilter() {
    setDraft('');
    local.setFilter && local.setFilter(local.columnId, '');
  }
  function onKeydown(e: any) {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      applyFilter();
    } else if (e && e.key === 'Escape') {
      e.preventDefault();
      clearFilter();
    }
  }
  function onBlur() {
    applyFilter();
  }

  return (
    <>
    <input part="col-filter" type="text" aria-label={local.columnId} class={"rdt-col-filter"} value={draft()} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput($event); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown($event); }} onBlur={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onBlur(); }} data-rozie-s-18cbb44e="" />
    </>
  );
}
