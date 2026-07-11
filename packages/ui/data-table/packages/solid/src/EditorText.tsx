import type { JSX } from 'solid-js';
import { createEffect, createSignal, mergeProps, on, onMount, splitProps, untrack } from 'solid-js';

interface EditorTextProps {
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
  commit?: ((...args: unknown[]) => unknown) | null;
  /**
   * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
   */
  cancel?: ((...args: unknown[]) => unknown) | null;
  /**
   * Focus this editor's primary input when true — the host sets it for the one editor that should hold focus; reactive.
   */
  autofocus?: boolean;
}

export default function EditorText(_props: EditorTextProps): JSX.Element {
  const _merged = mergeProps({ columnId: '', column: null, row: null, value: null, commit: null, cancel: null, autofocus: false }, _props);
  const [local, attrs] = splitProps(_merged, ['columnId', 'column', 'row', 'value', 'commit', 'cancel', 'autofocus']);

  const [draft, setDraft] = createSignal('');
  onMount(() => {
    if (local.autofocus) inputElRef?.focus();
  });
  createEffect(on(() => (() => local.autofocus)(), (v) => untrack(() => ((v: any) => {
    if (v) inputElRef?.focus();
  })(v)), { defer: true }));
  let inputElRef: HTMLElement | null = null;

  // Seed the draft once at setup from the incoming value (setup-once, NOT in the
  // template). Normalize null/undefined to '' so the input value binds to a string.
  setDraft(local.value != null ? String(local.value) : '');

  // Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
  // ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
  function onInput(e: any) {
    setDraft(e && e.target ? e.target.value : '');
  }

  // commit/cancel are Function props (default null) — guard before calling.
  function doCommit() {
    local.commit && local.commit(draft());
  }
  function doCancel() {
    local.cancel && local.cancel();
  }
  function onKeydown(e: any) {
    if (e && e.key === 'Enter') {
      e.preventDefault();
      doCommit();
    } else if (e && e.key === 'Escape') {
      e.preventDefault();
      doCancel();
    }
  }
  function onBlur() {
    doCommit();
  }

  // Editor-owns-focus contract: focus OUR OWN input when the host says we should hold focus.
  // $onMount covers the initial open (autofocus already true on first render); the LAZY $watch
  // (NOT { immediate: true } — an immediate watch fires PRE-mount, null ref on Lit/Solid) covers
  // a REACTIVE refocus while already mounted (e.g. a row-mode validation failure that flips
  // autofocus back onto this already-open drop-in).

  return (
    <>
    <input type="text" data-editing-cell="" aria-label={local.columnId} ref={(el) => { inputElRef = el as HTMLElement; }} class={"rdt-cell-editor"} value={draft()} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { onInput($event); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element }) => { onKeydown($event); }} onBlur={($event: FocusEvent & { currentTarget: HTMLInputElement; target: Element }) => { onBlur(); }} data-rozie-s-0d17f43a="" />
    </>
  );
}
