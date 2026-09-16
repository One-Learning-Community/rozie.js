<script lang="ts">
import { rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import { onMount, untrack } from 'svelte';

interface Props {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#editor` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
   */
  row?: (unknown) | null;
  /**
   * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit (Escape). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
   */
  options?: any[];
  /**
   * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
  /**
   * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
   */
  columnLabel?: string;
}

let __defaultOptions = (() => [])();

let {
  columnId = '',
  column = null,
  row = null,
  value = null,
  commit = null,
  cancel = null,
  options = __defaultOptions,
  autofocus = false,
  columnLabel = ''
}: Props = $props();

let draft = $state('');

let selectEl = $state<HTMLSelectElement | undefined>(undefined);

// Seed the draft once from the incoming value (setup-once). Normalize null/undefined
// to '' so the <select> binds to a string.
draft = value != null ? String(value) : '';
// Picking/arrow-cycling an option updates the draft only — no commit.
const onChange = (e: any) => {
  draft = e && e.target ? e.target.value : '';
};
// commit/cancel are Function props (default null) — guard before calling.
const doCommit = () => {
  commit && commit(draft);
};
const doCancel = () => {
  cancel && cancel();
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    doCommit();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    doCancel();
  }
};
const onBlur = () => {
  doCommit();
};
// C-11 — the accessible name must be the column's HUMAN header, not its internal id.
// `columnId` is a lookup key (`unit_price`, `col_3`); a screen reader announcing it is
// reading an implementation detail aloud. table-core keeps the authored header on
// `column.columnDef.header`, which is a string for every declarative `<Column header>`;
// a header rendered by a function has no static text, so fall back to the id rather
// than invent one.
const a11yLabel = () => {
  if (typeof columnLabel === 'string' && columnLabel !== '') return columnLabel;
  return columnId;
};

// C-02 / editor-owns-focus: focus OUR OWN control when the host says we should hold it.
// $onMount covers the initial open (autofocus is already true on first render); the LAZY
// $watch (NOT { immediate: true } — an immediate watch fires PRE-mount and sees a null
// ref on Lit/Solid) covers a REACTIVE refocus while already mounted, e.g. a row-mode
// validation failure flipping autofocus back onto this already-open drop-in.

onMount(() => {
  if (autofocus) selectEl?.focus();
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => autofocus)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (v) selectEl?.focus();
})(__watchVal); }); });
</script>

<select bind:this={selectEl} class="rdt-cell-editor" data-editing-cell="" aria-label={rozieAttr(a11yLabel())} value={draft} onchange={($event) => { onChange($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-117f1a16>{#each options as opt (opt.value)}<option value={rozieAttr(opt.value)} data-rozie-s-117f1a16>{rozieDisplay(opt.label)}</option>{/each}</select>
