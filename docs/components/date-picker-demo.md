---
title: DatePicker — live demo
---

<script setup lang="ts">
import { ref, computed } from 'vue';
import DatePicker from '@rozie-ui/date-picker-vue';

const date = ref('');
const lastChange = ref<string | null>(null);

function onChange(e: { value: string }) {
  lastChange.value = e.value;
}

// A second instance with bounds + a Monday-first week + a couple of disabled days.
const date2 = ref('');
const disabledDates = ['2026-06-17', '2026-06-18'];

const pretty = computed(() =>
  date.value
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(
        new Date(date.value + 'T00:00:00Z'),
      )
    : '—',
);

// Range mode: value is a { start, end } object, plus a quick-pick preset rail.
const range = ref<{ start: string; end: string }>({ start: '', end: '' });
const lastRange = ref<string | null>(null);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const presetRanges = [
  { label: 'Q1 2026', range: { start: '2026-01-01', end: '2026-03-31' } },
  { label: 'Last 7 days', range: () => ({ start: iso(new Date(Date.now() - 6 * 864e5)), end: iso(new Date()) }) },
];
function onRangeComplete(e: { value: { start: string; end: string } }) {
  lastRange.value = `${e.value.start} → ${e.value.end}`;
}
</script>

# DatePicker — live demo

This is the **real `@rozie-ui/date-picker-vue` package** running on this page (VitePress is itself a Vue app). Click a day, use the prev/next arrows, or focus the grid and use the arrow keys / Home / End / PageUp / PageDown / Enter to drive it entirely from the keyboard — the two-way bound ISO date updates and the `@change` readout fires. Everything below is driven by the same `DatePicker.rozie` source that compiles to all six frameworks, with **no engine and no required CSS** — the calendar logic and a tokenised skin ship inside the component.

<ClientOnly>
<div class="dp-live">

  <DatePicker v-model:value="date" @change="onChange" />

  <p class="dp-live__readout">
    selected <code>value</code>: <strong>{{ date || '—' }}</strong><br />
    formatted: <strong>{{ pretty }}</strong><br />
    last <code>@change</code>: <strong>{{ lastChange ?? '—' }}</strong>
  </p>

  <hr />

  <h2>Bounds, disabled days &amp; Monday-first</h2>
  <p>
    The same component with <code>:min="'2026-06-05'"</code>, <code>:max="'2026-06-26'"</code>,
    <code>:weekStartsOn="1"</code> and two disabled days (June 17–18):
  </p>

  <DatePicker
    v-model:value="date2"
    :min="'2026-06-05'"
    :max="'2026-06-26'"
    :weekStartsOn="1"
    :disabledDates="disabledDates"
  />

  <p class="dp-live__readout">picked: <strong>{{ date2 || '—' }}</strong></p>

  <hr />

  <h2>Range selection with presets</h2>
  <p>
    The same component with <code>selectionMode="range"</code>, a two-way bound
    <code>{ start, end }</code> object <code>value</code>, and a quick-pick
    <code>:presetRanges</code> rail (one literal range + one <code>() =&gt; …</code> thunk).
    Click an anchor day, then a second day in either direction — the preview band fills as you
    hover and <code>@rangeComplete</code> fires when the second endpoint lands.
  </p>

  <DatePicker
    selectionMode="range"
    v-model:value="range"
    :presetRanges="presetRanges"
    @rangeComplete="onRangeComplete"
  />

  <p class="dp-live__readout">
    selected <code>start</code>: <strong>{{ range.start || '—' }}</strong><br />
    selected <code>end</code>: <strong>{{ range.end || '—' }}</strong><br />
    last <code>@rangeComplete</code>: <strong>{{ lastRange ?? '—' }}</strong>
  </p>

</div>
</ClientOnly>

<style scoped>
.dp-live { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
.dp-live__readout { font-size: 0.9rem; }
</style>
