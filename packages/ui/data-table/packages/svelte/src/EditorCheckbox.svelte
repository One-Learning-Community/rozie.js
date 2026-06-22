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

// Immediate-commit-on-change: read .checked the global-filter way, coerce to a
// real boolean, and commit it directly.
const onChange = (e: any) => {
  commit && commit(!!(e && e.target ? e.target.checked : false));
};
const onKeydown = (e: any) => {
  if (e && e.key === 'Escape') {
    e.preventDefault();
    cancel && cancel();
  }
};
</script>

<input class="rdt-cell-editor" type="checkbox" data-editing-cell="" aria-label={columnId} checked={!!value} onchange={($event) => { onChange($event); }} onkeydown={($event) => { onKeydown($event); }} data-rozie-s-3d792482 />
