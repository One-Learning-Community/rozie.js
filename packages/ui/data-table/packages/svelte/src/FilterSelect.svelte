<script lang="ts">
import { rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

interface Props {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: any[]) => any) | null;
  uniqueValues?: any[];
}

let __defaultUniqueValues = (() => [])();

let {
  columnId = '',
  column = null,
  value = null,
  setFilter = null,
  uniqueValues = __defaultUniqueValues
}: Props = $props();

// The <select> value binding coerced to a string. $props.value is typed `unknown`
// (opaque slot-scope), which the strict bundled-leaf tsc rejects against the native
// select `value` type on React/Solid — the fix is a plain function returning a
// string (uniform ×6, NOT a $computed; the EditorSelect/listbox value lesson).
const selectValue = () => value != null ? String(value) : '';

// Immediate-apply-on-change: read the selected value the global-filter way. An
// empty value (the leading "All" option) clears the column filter.
// Immediate-apply-on-change: read the selected value the global-filter way. An
// empty value (the leading "All" option) clears the column filter.
const onChange = (e: any) => {
  const v = e && e.target ? e.target.value : '';
  if (v === '') {
    setFilter && setFilter(columnId, '');
  } else {
    setFilter && setFilter(columnId, v);
  }
};
</script>

<select class="rdt-col-filter" aria-label={columnId} value={rozieAttr(selectValue())} onchange={($event) => { onChange($event); }} data-rozie-s-d75b42b2><option value="" data-rozie-s-d75b42b2>All</option>{#each uniqueValues as opt (opt)}<option value={rozieAttr(opt)} data-rozie-s-d75b42b2>{rozieDisplay(opt)}</option>{/each}</select>
