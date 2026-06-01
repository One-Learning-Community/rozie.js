<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount, untrack } from 'svelte';

interface Props {
  date?: string;
  mode?: string;
  dateFormat?: string;
  altInput?: boolean;
  altFormat?: string;
  enableTime?: boolean;
  enableSeconds?: boolean;
  time24hr?: boolean;
  noCalendar?: boolean;
  minDate?: (string) | null;
  maxDate?: (string) | null;
  placeholder?: string;
  disabled?: boolean;
  commitOn?: string;
  options?: any;
  onchange?: (...args: unknown[]) => void;
  onready?: (...args: unknown[]) => void;
  onopen?: (...args: unknown[]) => void;
  onclose?: (...args: unknown[]) => void;
  onmonthchange?: (...args: unknown[]) => void;
  onyearchange?: (...args: unknown[]) => void;
  onvalueupdate?: (...args: unknown[]) => void;
  ondaycreate?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultOptions = (() => ({}))();

let {
  date = $bindable(''),
  mode = 'single',
  dateFormat = 'Y-m-d',
  altInput = false,
  altFormat = 'F j, Y',
  enableTime = false,
  enableSeconds = false,
  time24hr = false,
  noCalendar = false,
  minDate = null,
  maxDate = null,
  placeholder = 'Select a date…',
  disabled = false,
  commitOn = 'complete',
  options = __defaultOptions,
  onchange,
  onready,
  onopen,
  onclose,
  onmonthchange,
  onyearchange,
  onvalueupdate,
  ondaycreate,
  ...__rozieAttrs
}: Props = $props();

let inputEl = $state<HTMLInputElement | undefined>(undefined);

import flatpickr from 'flatpickr';
let instance: any = null;

onMount(() => {
  instance = flatpickr(inputEl!, {
    mode: mode,
    dateFormat: dateFormat,
    altInput: altInput,
    altFormat: altFormat,
    enableTime: enableTime,
    enableSeconds: enableSeconds,
    time_24hr: time24hr,
    noCalendar: noCalendar,
    minDate: minDate,
    maxDate: maxDate,
    defaultDate: date || null,
    ...options,
    onChange: (selectedDates: any, dateStr: any) => {
      // Value contract + range-commit semantics. In range mode flatpickr fires
      // onChange on the FIRST click (partial range) — committing then is the
      // bug every wrapper ships. Commit the string only when the range is
      // complete (2 dates) unless the consumer opted into commitOn:'change'.
      const isRange = mode === 'range';
      const complete = !isRange || selectedDates.length === 2;
      if ((commitOn === 'change' || complete) && dateStr !== date) {
        date = dateStr;
      }
      // Always surface BOTH the formatted string and the Date[] so consumers
      // that need the parsed objects (range bounds, multi-select) get them.
      onchange?.({
        value: dateStr,
        selectedDates
      });
    },
    onReady: (d: any, s: any) => onready?.({
      value: s,
      selectedDates: d
    }),
    onOpen: () => onopen?.(),
    onClose: () => onclose?.(),
    onMonthChange: () => onmonthchange?.(),
    onYearChange: () => onyearchange?.(),
    onValueUpdate: (d: any, s: any) => onvalueupdate?.({
      value: s,
      selectedDates: d
    }),
    onDayCreate: (_d: any, _s: any, _fp: any, dayElem: any) => ondaycreate?.(dayElem)
  });
  if (disabled) instance.input.disabled = true;
  return () => instance?.destroy();
});

$effect(() => { const __watchVal = (() => date)(); untrack(() => ((v: any) => {
  if (!instance) return;
  if (v !== instance.input.value) instance.setDate(v, false);
})(__watchVal)); });
$effect(() => { const __watchVal = (() => mode)(); untrack(() => ((v: any) => instance?.set('mode', v))(__watchVal)); });
$effect(() => { const __watchVal = (() => minDate)(); untrack(() => ((v: any) => instance?.set('minDate', v))(__watchVal)); });
$effect(() => { const __watchVal = (() => maxDate)(); untrack(() => ((v: any) => instance?.set('maxDate', v))(__watchVal)); });
$effect(() => { const __watchVal = (() => dateFormat)(); untrack(() => ((v: any) => instance?.set('dateFormat', v))(__watchVal)); });
$effect(() => { const __watchVal = (() => disabled)(); untrack(() => ((v: any) => {
  if (instance) instance.input.disabled = v;
})(__watchVal)); });
</script>


<input bind:this={inputEl} type="text" placeholder={placeholder} {...__rozieAttrs} class={["rozie-flatpickr", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-159070d4 />


<style>
:global {
  .rozie-flatpickr[data-rozie-s-159070d4] {
    padding: 0.375rem 0.5rem;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    font: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .rozie-flatpickr[data-rozie-s-159070d4]:focus {
    outline: 2px solid rgba(0, 100, 255, 0.4);
    outline-offset: -1px;
  }
}
</style>
