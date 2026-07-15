<script lang="ts">
import { onMount, untrack } from 'svelte';

interface Props {
  /**
   * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
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
   * The current cell value the editor seeds its local draft from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
   */
  commit?: ((...args: any[]) => any) | null;
  /**
   * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
   */
  cancel?: ((...args: any[]) => any) | null;
  /**
   * Focus this editor's primary input when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
}

let {
  columnId = '',
  column = null,
  row = null,
  value = null,
  commit = null,
  cancel = null,
  autofocus = false
}: Props = $props();

let draft = $state('');

let inputEl = $state<HTMLInputElement | undefined>(undefined);

// Seed the draft once at setup from the incoming value (setup-once, NOT in the
// template). Normalize null/undefined to '' so the input value binds to a string.
draft = value != null ? String(value) : '';
// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
const onInput = (e: any) => {
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

// Editor-owns-focus contract: focus OUR OWN input when the host says we should hold focus.
// $onMount covers the initial open (autofocus already true on first render); the LAZY $watch
// (NOT { immediate: true } — an immediate watch fires PRE-mount, null ref on Lit/Solid) covers
// a REACTIVE refocus while already mounted (e.g. a row-mode validation failure that flips
// autofocus back onto this already-open drop-in).

onMount(() => {
  if (autofocus) inputEl?.focus();
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => autofocus)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (v) inputEl?.focus();
})(__watchVal); }); });
</script>

<input bind:this={inputEl} class="rdt-cell-editor" type="text" data-editing-cell="" aria-label={columnId} value={draft} oninput={($event) => { onInput($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-0d17f43a />
