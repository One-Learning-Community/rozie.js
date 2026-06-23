<script lang="ts">
interface Props {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: any[]) => any) | null;
}

let {
  columnId = '',
  column = null,
  value = null,
  setFilter = null
}: Props = $props();

let draft = $state('');

// Seed the draft once at setup from the incoming value (setup-once, NOT in the
// template). Normalize null/undefined to '' so the input value binds to a string.
draft = value != null ? String(value) : '';

// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
// Untyped handler param neutralizes to `any`, so reading e.target.value typechecks
// ×6 (the global-filter idiom). Never inline `$data.x = $event.target.value`.
const onInput = (e: any) => {
  draft = e && e.target ? e.target.value : '';
};

// setFilter is a Function prop (default null) — guard before calling.
// setFilter is a Function prop (default null) — guard before calling.
const applyFilter = () => {
  setFilter && setFilter(columnId, draft);
};
const clearFilter = () => {
  draft = '';
  setFilter && setFilter(columnId, '');
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Enter') {
    e.preventDefault();
    applyFilter();
  } else if (e && e.key === 'Escape') {
    e.preventDefault();
    clearFilter();
  }
};
const onBlur = () => {
  applyFilter();
};
</script>

<input class="rdt-col-filter" type="text" aria-label={columnId} value={draft} oninput={($event) => { onInput($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-18cbb44e />
