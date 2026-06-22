<script lang="ts">
interface Props {
  columnId?: string;
  column?: (unknown) | null;
  row?: (unknown) | null;
  value?: (unknown) | null;
  commit?: ((...args: any[]) => any) | null;
  cancel?: ((...args: any[]) => any) | null;
}

let {
  columnId = '',
  column = null,
  row = null,
  value = null,
  commit = null,
  cancel = null
}: Props = $props();

let draft = $state('');

// Seed the draft once from the incoming value (setup-once). A native date input
// only accepts `YYYY-MM-DD`; normalize null/undefined to ''.
draft = value != null ? String(value) : '';
const onInput = (e: any) => {
  draft = e && e.target ? e.target.value : '';
};
const doCommit = () => {
  // commit the ISO date string the native control already produced.
  commit && commit(draft);
};
const doCancel = () => {
  cancel && cancel();
};
const onChange = (e: any) => {
  draft = e && e.target ? e.target.value : '';
  doCommit();
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
</script>

<input class="rdt-cell-editor" type="date" data-editing-cell="" aria-label={columnId} value={draft} oninput={($event) => { onInput($event); }} onchange={($event) => { onChange($event); }} onkeydown={($event) => { onKeydown($event); }} onblur={($event) => { onBlur(); }} data-rozie-s-7abe1a56 />
