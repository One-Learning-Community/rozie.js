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
  name?: string;
  inline?: boolean;
  staticPosition?: boolean;
  position?: string;
  appendTo?: (any) | null;
  showMonths?: number;
  weekNumbers?: boolean;
  monthSelectorType?: string;
  prevArrow?: (string) | null;
  nextArrow?: (string) | null;
  allowInput?: boolean;
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
  name = '',
  inline = false,
  staticPosition = false,
  position = 'auto',
  appendTo = null,
  showMonths = 1,
  weekNumbers = false,
  monthSelectorType = 'dropdown',
  prevArrow = null,
  nextArrow = null,
  allowInput = false,
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
// Imperative handle (Phase 21 $expose). The five flatpickr instance methods a
// consumer can't drive through props alone — exposed uniformly to all 6 targets
// (Vue defineExpose / React useImperativeHandle / Svelte instance export /
// Angular+Lit public method / Solid callback ref). Each guards on `instance`
// (null before $onMount and after destroy). selectDate forwards flatpickr's own
// triggerChange arg; leaving it undefined keeps flatpickr's default (no
// onChange refire), so a programmatic selectDate does not bounce through the
// round-trip-guarded $watch above.
//
// Two method names are deliberately NOT flatpickr's own, to avoid collisions
// with this component's emitted surface (a real cross-target footgun — see the
// Step-4 gap report):
//   - `selectDate` (not `setDate`): the `date` prop is `model: true`, so React's
//     emitter auto-generates a `setDate` setter for it (useControllableState
//     destructure). A user `setDate` collides — ROZ524 ("already declared" +
//     infinite-recursion of the model-write rewrite). selectDate wraps
//     flatpickr's instance.setDate.
//   - `openPicker` / `closePicker` (not `open` / `close`): this component emits
//     `open` and `close` EVENTS (onOpen/onClose -> $emit). On targets that
//     materialize events as named members (Angular `output()`), a method named
//     `open`/`close` collides with the event member and the emitter silently
//     renames the method to `_open`/`_close` — breaking the uniform handle. No
//     diagnostic fires today (unlike the model-setter ROZ524); flagged for a
//     future ROZ "expose-name vs event-name collision" check. Prefixing the
//     methods sidesteps it.
export function clear() {
  instance?.clear();
}
export function openPicker() {
  instance?.open();
}
export function closePicker() {
  instance?.close();
}
export function selectDate(date: any, triggerChange: any) {
  instance?.setDate(date, triggerChange);
}
export function jumpToDate(date: any) {
  instance?.jumpToDate(date);
}

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
    // GAP-5 UI passthrough (construction-time only) + GAP-6a allowInput.
    // These match flatpickr's own defaults so passing them is render-neutral.
    inline: inline,
    static: staticPosition,
    position: position,
    showMonths: showMonths,
    weekNumbers: weekNumbers,
    monthSelectorType: monthSelectorType,
    allowInput: allowInput,
    // `appendTo` / `prevArrow` / `nextArrow` default to null here but flatpickr
    // expects them ABSENT (its own defaults are `undefined` for appendTo and
    // built-in SVG strings for the arrows). Passing an explicit null breaks
    // construction, so include each ONLY when the consumer set a real value.
    ...(appendTo != null ? {
      appendTo: appendTo
    } : {}),
    ...(prevArrow != null ? {
      prevArrow: prevArrow
    } : {}),
    ...(nextArrow != null ? {
      nextArrow: nextArrow
    } : {}),
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


<input bind:this={inputEl} type="text" name={name} placeholder={placeholder} {...__rozieAttrs} class={["rozie-flatpickr", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-159070d4 />


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
