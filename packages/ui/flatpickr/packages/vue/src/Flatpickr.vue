<template>

<input ref="inputElRef" type="text" class="rozie-flatpickr" :name="props.name" :placeholder="props.placeholder" v-bind="$attrs" />

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ mode?: string; dateFormat?: string; altInput?: boolean; altFormat?: string; enableTime?: boolean; enableSeconds?: boolean; time24hr?: boolean; noCalendar?: boolean; minDate?: string | null; maxDate?: string | null; placeholder?: string; disabled?: boolean; commitOn?: string; options?: Record<string, any>; name?: string; inline?: boolean; staticPosition?: boolean; position?: string; appendTo?: Record<string, any> | null; showMonths?: number; weekNumbers?: boolean; monthSelectorType?: string; prevArrow?: string | null; nextArrow?: string | null; allowInput?: boolean; disable?: any[]; enable?: any[]; locale?: Record<string, any> | null; firstDayOfWeek?: number; parseDate?: ((...args: any[]) => any) | null; formatDate?: ((...args: any[]) => any) | null; plugins?: any[] }>(),
  { mode: 'single', dateFormat: 'Y-m-d', altInput: false, altFormat: 'F j, Y', enableTime: false, enableSeconds: false, time24hr: false, noCalendar: false, minDate: null, maxDate: null, placeholder: 'Select a date…', disabled: false, commitOn: 'complete', options: () => ({}), name: '', inline: false, staticPosition: false, position: 'auto', appendTo: null, showMonths: 1, weekNumbers: false, monthSelectorType: 'dropdown', prevArrow: null, nextArrow: null, allowInput: false, disable: () => [], enable: () => [], locale: null, firstDayOfWeek: 0, parseDate: null, formatDate: null, plugins: () => [] }
);

const date = defineModel<string>('date', { default: '' });

const emit = defineEmits<{
  change: [...args: any[]];
  ready: [...args: any[]];
  open: [...args: any[]];
  close: [...args: any[]];
  monthChange: [...args: any[]];
  yearChange: [...args: any[]];
  valueUpdate: [...args: any[]];
  dayCreate: [...args: any[]];
}>();

const inputElRef = ref<HTMLInputElement>();

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
function clear() {
  instance?.clear();
}
function openPicker() {
  instance?.open();
}
function closePicker() {
  instance?.close();
}
function selectDate(date: any, triggerChange: any) {
  instance?.setDate(date, triggerChange);
}
function jumpToDate(date: any) {
  instance?.jumpToDate(date);
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  instance = flatpickr(inputElRef.value!, {
    mode: props.mode,
    dateFormat: props.dateFormat,
    altInput: props.altInput,
    altFormat: props.altFormat,
    enableTime: props.enableTime,
    enableSeconds: props.enableSeconds,
    time_24hr: props.time24hr,
    noCalendar: props.noCalendar,
    minDate: props.minDate,
    maxDate: props.maxDate,
    defaultDate: date.value || null,
    // GAP-5 UI passthrough (construction-time only) + GAP-6a allowInput.
    // These match flatpickr's own defaults so passing them is render-neutral.
    inline: props.inline,
    static: props.staticPosition,
    position: props.position,
    showMonths: props.showMonths,
    weekNumbers: props.weekNumbers,
    monthSelectorType: props.monthSelectorType,
    allowInput: props.allowInput,
    // `appendTo` / `prevArrow` / `nextArrow` default to null here but flatpickr
    // expects them ABSENT (its own defaults are `undefined` for appendTo and
    // built-in SVG strings for the arrows). Passing an explicit null breaks
    // construction, so include each ONLY when the consumer set a real value.
    ...(props.appendTo != null ? {
      appendTo: props.appendTo
    } : {}),
    ...(props.prevArrow != null ? {
      prevArrow: props.prevArrow
    } : {}),
    ...(props.nextArrow != null ? {
      nextArrow: props.nextArrow
    } : {}),
    // GAP-2/3/4/6b conditional-spread passthrough. NEVER pass an empty array /
    // null / default-0, because flatpickr treats `enable: []` as "nothing
    // enabled" and a null locale/parseDate/formatDate breaks construction —
    // each guard keeps the default render byte-identical to before.
    ...(props.disable.length ? {
      disable: props.disable
    } : {}),
    ...(props.enable.length ? {
      enable: props.enable
    } : {}),
    ...(props.parseDate != null ? {
      parseDate: props.parseDate
    } : {}),
    ...(props.formatDate != null ? {
      formatDate: props.formatDate
    } : {}),
    ...(props.plugins.length ? {
      plugins: props.plugins
    } : {}),
    // locale + firstDayOfWeek merge: emit a single `locale` entry present when
    // EITHER a locale object is set OR firstDayOfWeek is non-default (0). The
    // merge folds firstDayOfWeek INTO the locale object so it overrides the
    // locale's own. Kept a PURE expression (no statements) so Angular can splice
    // it into a binding context safely.
    ...(props.locale != null || props.firstDayOfWeek !== 0 ? {
      locale: {
        ...(props.locale ?? {}),
        ...(props.firstDayOfWeek !== 0 ? {
          firstDayOfWeek: props.firstDayOfWeek
        } : {})
      }
    } : {}),
    ...props.options,
    onChange: (selectedDates: any, dateStr: any) => {
      // Value contract + range-commit semantics. In range mode flatpickr fires
      // onChange on the FIRST click (partial range) — committing then is the
      // bug every wrapper ships. Commit the string only when the range is
      // complete (2 dates) unless the consumer opted into commitOn:'change'.
      const isRange = props.mode === 'range';
      const complete = !isRange || selectedDates.length === 2;
      if ((props.commitOn === 'change' || complete) && dateStr !== date.value) {
        date.value = dateStr;
      }
      // Always surface BOTH the formatted string and the Date[] so consumers
      // that need the parsed objects (range bounds, multi-select) get them.
      emit('change', {
        value: dateStr,
        selectedDates
      });
    },
    onReady: (d: any, s: any) => emit('ready', {
      value: s,
      selectedDates: d
    }),
    onOpen: () => emit('open'),
    onClose: () => emit('close'),
    onMonthChange: () => emit('monthChange'),
    onYearChange: () => emit('yearChange'),
    onValueUpdate: (d: any, s: any) => emit('valueUpdate', {
      value: s,
      selectedDates: d
    }),
    onDayCreate: (_d: any, _s: any, _fp: any, dayElem: any) => emit('dayCreate', dayElem)
  });
  if (props.disabled) instance.input.disabled = true;
  _cleanup_0 = () => instance?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => date.value, (v: any) => {
  if (!instance) return;
  if (v !== instance.input.value) instance.setDate(v, false);
});
watch(() => props.mode, (v: any) => instance?.set('mode', v));
watch(() => props.minDate, (v: any) => instance?.set('minDate', v));
watch(() => props.maxDate, (v: any) => instance?.set('maxDate', v));
watch(() => props.dateFormat, (v: any) => instance?.set('dateFormat', v));
watch(() => props.disabled, (v: any) => {
  if (instance) instance.input.disabled = v;
});
watch(() => props.disable, (v: any) => instance?.set('disable', v));
watch(() => props.enable, (v: any) => instance?.set('enable', v));
watch(() => props.locale, (v: any) => instance?.set('locale', {
  ...(v ?? {}),
  ...(props.firstDayOfWeek !== 0 ? {
    firstDayOfWeek: props.firstDayOfWeek
  } : {})
}));
watch(() => props.firstDayOfWeek, (v: any) => instance?.set('locale', {
  ...(props.locale ?? {}),
  ...(v !== 0 ? {
    firstDayOfWeek: v
  } : {})
}));

defineExpose({ clear, openPicker, closePicker, selectDate, jumpToDate });
</script>

<style scoped>
.rozie-flatpickr {
  padding: 0.375rem 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  font: inherit;
  width: 100%;
  box-sizing: border-box;
}
.rozie-flatpickr:focus {
  outline: 2px solid rgba(0, 100, 255, 0.4);
  outline-offset: -1px;
}
</style>
