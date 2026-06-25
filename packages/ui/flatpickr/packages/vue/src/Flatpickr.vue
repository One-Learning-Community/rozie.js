<template>

<input ref="inputElRef" type="text" class="rozie-flatpickr" :name="props.name" :placeholder="props.placeholder" v-bind="$attrs" />

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Selection mode: `'single'`, `'multiple'`, `'range'`, or `'time'`. In `'range'` mode the two-way `date` commits per `commitOn`. Runtime-updatable via flatpickr's `set()`.
     */
    mode?: string;
    /**
     * flatpickr date-format token string controlling how the value is formatted and parsed. Runtime-updatable via `set()`.
     */
    dateFormat?: string;
    /**
     * Show a human-readable alt input (formatted with `altFormat`) while submitting the machine-format value. flatpickr creates a hidden mirror input and moves the original `name` onto it. **Construction-time only** — re-key the component to retune live.
     */
    altInput?: boolean;
    /**
     * Format token string for the human-readable alt input (used only when `altInput` is on).
     */
    altFormat?: string;
    /**
     * Add a time picker alongside the calendar. **Construction-time only** — re-key the component to retune live.
     */
    enableTime?: boolean;
    /**
     * Add a seconds input to the time picker (used with `enableTime`).
     */
    enableSeconds?: boolean;
    /**
     * Display time in 24-hour format instead of the AM/PM clock.
     */
    time24hr?: boolean;
    /**
     * Hide the calendar to make a time-only picker (pair with `enableTime`). **Construction-time only** — re-key the component to retune live.
     */
    noCalendar?: boolean;
    /**
     * Earliest selectable date (a `dateFormat`-formatted string). Runtime-updatable via `set()`.
     */
    minDate?: string | null;
    /**
     * Latest selectable date (a `dateFormat`-formatted string). Runtime-updatable via `set()`.
     */
    maxDate?: string | null;
    /**
     * Placeholder text for the rendered input when no date is selected.
     */
    placeholder?: string;
    /**
     * Disable the underlying input so the picker cannot be opened or edited. On Angular it OR-merges with the form `setDisabledState`. Runtime-updatable.
     */
    disabled?: boolean;
    /**
     * When to commit the two-way `date` in `mode="range"`: `'complete'` (the default — only once both ends are picked) or `'change'` (on every click, including the partial first click). The `change` event always fires on every click regardless, so partial ranges are observable off the event without polluting the two-way value.
     */
    commitOn?: string;
    /**
     * Verbatim flatpickr options pass-through for anything the named props do not cover. It is spread **after** the named props, so a key here overrides the equivalent named prop on conflict.
     */
    options?: Record<string, any>;
    /**
     * HTML form-control `name` forwarded onto the rendered input — the forms drop-in, so `Flatpickr` submits like a native control. When `altInput` is on, flatpickr moves the `name` onto the hidden mirror input, so the submitted value carries it either way.
     */
    name?: string;
    /**
     * Render an always-visible calendar inline instead of a popup — useful for dashboards and embedded pickers. **Construction-time only** — re-key the component to toggle live.
     */
    inline?: boolean;
    /**
     * flatpickr's `static` option — positions the calendar relative to the input rather than absolutely off `<body>`. Exposed as `staticPosition` because `static` is a JS reserved word. **Construction-time only**.
     */
    staticPosition?: boolean;
    /**
     * Calendar popup position: `'auto'`, `'above'`, `'below'`, or per-axis forms like `'above center'`. **Construction-time only**.
     */
    position?: string;
    /**
     * A DOM element to append the calendar popup to, useful for escaping `overflow: hidden` ancestors. **Construction-time only**.
     */
    appendTo?: Record<string, any> | null;
    /**
     * Number of calendar months to render side by side. **Construction-time only**.
     */
    showMonths?: number;
    /**
     * Show ISO week numbers down the left edge of the calendar. **Construction-time only**.
     */
    weekNumbers?: boolean;
    /**
     * Month-selector style in the calendar header: `'dropdown'` or `'static'`. **Construction-time only**.
     */
    monthSelectorType?: string;
    /**
     * HTML string for the previous-month navigation arrow, overriding flatpickr's built-in SVG. **Construction-time only**.
     */
    prevArrow?: string | null;
    /**
     * HTML string for the next-month navigation arrow, overriding flatpickr's built-in SVG. **Construction-time only**.
     */
    nextArrow?: string | null;
    /**
     * Allow the user to type a date directly into the input instead of only picking from the calendar. **Construction-time only**.
     */
    allowInput?: boolean;
    /**
     * Dates to disable: a mixed array of `Date` objects, `"Y-m-d"` strings, `{ from, to }` range objects, and/or predicate functions `(date: Date) => boolean`. Runtime-updatable via `set()` — a runtime `disable: []` clears the exclusion set.
     */
    disable?: any[];
    /**
     * Allow-list (the inverse of `disable`): when non-empty, ONLY these dates/ranges/predicates are selectable and everything else is disabled. Same element shapes as `disable`. Runtime-updatable via `set()`.
     */
    enable?: any[];
    /**
     * A flatpickr locale object (e.g. `import fr from 'flatpickr/dist/l10n/fr.js'`). The consumer lazy-imports it themselves — the wrapper adds no locale dependency. Runtime-updatable via `set('locale', …)`.
     */
    locale?: Record<string, any> | null;
    /**
     * First weekday of the calendar (`0` = Sunday … `1` = Monday). Folded into the `locale` option and overrides the locale's own first weekday when set. Runtime-updatable.
     */
    firstDayOfWeek?: number;
    /**
     * Custom parser `(dateStr: string, format: string) => Date` for input formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
     */
    parseDate?: ((...args: any[]) => any) | null;
    /**
     * Custom formatter `(date: Date, format: string, locale) => string` for output formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
     */
    formatDate?: ((...args: any[]) => any) | null;
    /**
     * An array of flatpickr plugin instances (imported from `flatpickr/dist/plugins/…`); the headline use is `rangePlugin` for two-input ranges. **Construction-time only** — re-key the component to swap plugins live.
     */
    plugins?: any[];
  }>(),
  { mode: 'single', dateFormat: 'Y-m-d', altInput: false, altFormat: 'F j, Y', enableTime: false, enableSeconds: false, time24hr: false, noCalendar: false, minDate: null, maxDate: null, placeholder: 'Select a date…', disabled: false, commitOn: 'complete', options: () => ({}), name: '', inline: false, staticPosition: false, position: 'auto', appendTo: null, showMonths: 1, weekNumbers: false, monthSelectorType: 'dropdown', prevArrow: null, nextArrow: null, allowInput: false, disable: () => [], enable: () => [], locale: null, firstDayOfWeek: 0, parseDate: null, formatDate: null, plugins: () => [] }
);

/**
 * The two-way value (`r-model:date`) — the **formatted string** flatpickr produces, not a `Date`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Consumers that need the parsed `Date[]` read them off the `change` event payload instead.
 * @example
 * <Flatpickr r-model:date="picked" @change="onChange" />
 */
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
// Imperative handle (Phase 21 $expose). The flatpickr instance methods a
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
// getSelectedDates closes a real asymmetry: the two-way `date` model is a
// formatted STRING, but the parsed Date[] is otherwise only delivered on the
// `change` event payload — a consumer needing the current Date objects on demand
// (range bounds, multi-select, validation) had no path. `[]` before mount.
// getSelectedDates closes a real asymmetry: the two-way `date` model is a
// formatted STRING, but the parsed Date[] is otherwise only delivered on the
// `change` event payload — a consumer needing the current Date objects on demand
// (range bounds, multi-select, validation) had no path. `[]` before mount.
function getSelectedDates() {
  return instance ? instance.selectedDates : [];
}
// togglePicker = open-or-close in one call (natural for a single trigger button).
// `toggle` is not an emit, but suffixed `togglePicker` for symmetry with
// openPicker/closePicker.
// togglePicker = open-or-close in one call (natural for a single trigger button).
// `toggle` is not an emit, but suffixed `togglePicker` for symmetry with
// openPicker/closePicker.
function togglePicker() {
  instance?.toggle();
}
// Programmatic calendar navigation for custom prev/next / "jump N months" UI.
// changeMonth(value, isOffset?) — isOffset defaults to true (flatpickr). NOT
// `monthChange`, which is the emitted event (so ROZ121-clear).
// Programmatic calendar navigation for custom prev/next / "jump N months" UI.
// changeMonth(value, isOffset?) — isOffset defaults to true (flatpickr). NOT
// `monthChange`, which is the emitted event (so ROZ121-clear).
function changeMonth(value: any, isOffset: any) {
  instance?.changeMonth(value, isOffset);
}
// changeYear(year) — jump to an absolute year. NOT `yearChange` (the emit).
// changeYear(year) — jump to an absolute year. NOT `yearChange` (the emit).
function changeYear(year: any) {
  instance?.changeYear(year);
}

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  instance = (flatpickr as any)(inputElRef.value!, {
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

defineExpose({ clear, openPicker, closePicker, selectDate, jumpToDate, getSelectedDates, togglePicker, changeMonth, changeYear });
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
