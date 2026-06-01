<template>

<input ref="inputElRef" type="text" class="rozie-flatpickr" :placeholder="props.placeholder" v-bind="$attrs" />

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ mode?: string; dateFormat?: string; altInput?: boolean; altFormat?: string; enableTime?: boolean; enableSeconds?: boolean; time24hr?: boolean; noCalendar?: boolean; minDate?: string | null; maxDate?: string | null; placeholder?: string; disabled?: boolean; commitOn?: string; options?: Record<string, any> }>(),
  { mode: 'single', dateFormat: 'Y-m-d', altInput: false, altFormat: 'F j, Y', enableTime: false, enableSeconds: false, time24hr: false, noCalendar: false, minDate: null, maxDate: null, placeholder: 'Select a date…', disabled: false, commitOn: 'complete', options: () => ({}) }
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
}, { immediate: true });
watch(() => props.mode, (v: any) => instance?.set('mode', v), { immediate: true });
watch(() => props.minDate, (v: any) => instance?.set('minDate', v), { immediate: true });
watch(() => props.maxDate, (v: any) => instance?.set('maxDate', v), { immediate: true });
watch(() => props.dateFormat, (v: any) => instance?.set('dateFormat', v), { immediate: true });
watch(() => props.disabled, (v: any) => {
  if (instance) instance.input.disabled = v;
}, { immediate: true });
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
