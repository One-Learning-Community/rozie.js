<template>

<nav :class="['rozie-pagination', { 'rozie-pagination--disabled': props.disabled }]" ref="navRef" :aria-label="props.ariaLabel" v-bind="$attrs" @keydown="onControlKeydown($event)">
  
  <slot name="prevControl" :disabled="!canPrev() || props.disabled" :goto="goPrev" :page="currentPage() - 1">
    <button type="button" class="rozie-pagination-control rozie-pagination-prev" data-page-control="" :tabindex="(tabIndexFor(true)) ?? undefined" :disabled="!canPrev() || props.disabled" :aria-disabled="!!(!canPrev() || props.disabled)" aria-label="Previous page" @click="goPrev">‹</button>
  </slot>

  
  <template v-for="(item, index) in model().pages" :key="item + '-' + index">
    <span v-if="item === 'ellipsis'" class="rozie-pagination-ellipsis" aria-hidden="true">
      <slot name="ellipsis" :index="index">…</slot>
    </span><span v-if="item !== 'ellipsis'" class="rozie-pagination-item">
      <slot name="item" :page="item" :selected="isActive(item)" :goto="() => goToPage(item)">
        <button type="button" :class="['rozie-pagination-page', { 'is-active': isActive(item) }]" data-page-control="" :tabindex="(tabIndexFor(isActive(item))) ?? undefined" :disabled="!!props.disabled" :aria-disabled="!!props.disabled" :aria-current="isActive(item) ? 'page' : undefined" :aria-label="'Go to page ' + item" @click="goToPage(item)">{{ item }}</button>
      </slot>
    </span></template>

  
  <slot name="nextControl" :disabled="!canNext() || props.disabled" :goto="goNext" :page="currentPage() + 1">
    <button type="button" class="rozie-pagination-control rozie-pagination-next" data-page-control="" :tabindex="(tabIndexFor(true)) ?? undefined" :disabled="!canNext() || props.disabled" :aria-disabled="!!(!canNext() || props.disabled)" aria-label="Next page" @click="goNext">›</button>
  </slot>
</nav>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Explicit total page count. When provided (> 0) it takes precedence over `total` + `pageSize`. Use it when the backend already reports the page count.
     */
    totalPages?: number | null;
    /**
     * Total item count. Combined with `pageSize` to derive the page count (`ceil(total / pageSize)`) when `totalPages` is not given.
     */
    total?: number | null;
    /**
     * Items per page. Combined with `total` to derive the page count when `totalPages` is not given.
     */
    pageSize?: number | null;
    /**
     * Number of page buttons shown on each side of the current page (the sibling window). Larger values show more context around the current page.
     */
    siblingCount?: number;
    /**
     * Number of page buttons always shown at each boundary (the first and last `boundaryCount` pages), regardless of the current page.
     */
    boundaryCount?: number;
    /**
     * Disable the entire control — every page button and the prev/next controls become non-interactive and are marked `aria-disabled`.
     */
    disabled?: boolean;
    /**
     * Accessible name for the surrounding `<nav>` landmark (its `aria-label`). Defaults to `"Pagination"`.
     */
    ariaLabel?: string;
  }>(),
  { totalPages: null, total: null, pageSize: null, siblingCount: 1, boundaryCount: 1, disabled: false, ariaLabel: 'Pagination' }
);

/**
 * The 1-based current page (two-way model). Clamped into `[1, totalPages]`. Bind it with `r-model:modelValue` / `v-model:modelValue` / `modelValue` + `onModelValueChange`; it is also the Angular ControlValueAccessor control value.
 */
const modelValue = defineModel<number>('modelValue', { default: 1 });

const emit = defineEmits<{
  change: [...args: any[]];
}>();

defineSlots<{
  prevControl(props: { disabled: any; goto: any; page: any }): any;
  ellipsis(props: { index: any }): any;
  item(props: { page: any; selected: any; goto: any }): any;
  nextControl(props: { disabled: any; goto: any; page: any }): any;
}>();

const navRef = ref<HTMLElement>();

import { paginationItems } from './internal/paginationItems';

// ---- derived view (ONE plain function, uniform x6) ---------------------
// The whole render model in a single call: { totalPages, page, pages,
// hasPrev, hasNext }. A PLAIN function (not $computed) so it reads uniformly
// on all six targets and can be aliased in handlers without the Solid
// accessor divergence. Returns a FRESH object each call — never feed it to a
// reference-equality $watch getter.
// ---- derived view (ONE plain function, uniform x6) ---------------------
// The whole render model in a single call: { totalPages, page, pages,
// hasPrev, hasNext }. A PLAIN function (not $computed) so it reads uniformly
// on all six targets and can be aliased in handlers without the Solid
// accessor divergence. Returns a FRESH object each call — never feed it to a
// reference-equality $watch getter.
const model = () => paginationItems({
  page: modelValue.value,
  totalPages: props.totalPages,
  total: props.total,
  pageSize: props.pageSize,
  siblingCount: props.siblingCount,
  boundaryCount: props.boundaryCount
});

// The resolved effective total page count (read in the template + handlers).
// NAMED `effectivePages`, NOT `totalPages` — a `totalPages` helper would shadow
// the `totalPages` PROP, which on Lit becomes a class field of type `number`
// (hard TS2300/TS2717 against a `() => number` helper). The prop-name-collision
// sibling of the otp `inputMode` gotcha.
// The resolved effective total page count (read in the template + handlers).
// NAMED `effectivePages`, NOT `totalPages` — a `totalPages` helper would shadow
// the `totalPages` PROP, which on Lit becomes a class field of type `number`
// (hard TS2300/TS2717 against a `() => number` helper). The prop-name-collision
// sibling of the otp `inputMode` gotcha.
const effectivePages = () => model().totalPages;
// The clamped current page (the raw prop may be out of range).
// The clamped current page (the raw prop may be out of range).
const currentPage = () => model().page;
const canPrev = () => model().hasPrev;
const canNext = () => model().hasNext;
const isActive = (page: any) => page === currentPage();

// Roving-tabindex value for a control: the active page is the single tab stop
// (0), the rest are -1. The return type is annotated `number | undefined` ON
// PURPOSE: the React emitter wraps every numeric `:attr` binding in
// `(expr) ?? undefined`, and a PROVABLY non-null value (a bare `0`/`-1` or a
// `0 : -1` ternary) trips TS2869 "right operand of ?? is unreachable". Routing
// every tabindex through this nullable-typed helper keeps the `?? undefined`
// reachable (the data-table cellTabindex precedent).
// Roving-tabindex value for a control: the active page is the single tab stop
// (0), the rest are -1. The return type is annotated `number | undefined` ON
// PURPOSE: the React emitter wraps every numeric `:attr` binding in
// `(expr) ?? undefined`, and a PROVABLY non-null value (a bare `0`/`-1` or a
// `0 : -1` ternary) trips TS2869 "right operand of ?? is unreachable". Routing
// every tabindex through this nullable-typed helper keeps the `?? undefined`
// reachable (the data-table cellTabindex precedent).
const tabIndexFor = (active: any): number | undefined => active ? 0 : -1;

// ---- write funnel (single $emit site) ----------------------------------
// Clamp to [1, totalPages], write the model, and emit `change` with the new
// page. NOT named `setModelValue` (that collides with React's generated model
// setter → ROZ524) — `goToPage` is collision-safe across all six leaves.
// ---- write funnel (single $emit site) ----------------------------------
// Clamp to [1, totalPages], write the model, and emit `change` with the new
// page. NOT named `setModelValue` (that collides with React's generated model
// setter → ROZ524) — `goToPage` is collision-safe across all six leaves.
const goToPage = (page: any) => {
  if (props.disabled) return;
  const tp = effectivePages();
  let target = typeof page === 'number' ? Math.floor(page) : 1;
  if (target < 1) target = 1;
  if (target > tp) target = tp;
  if (target === currentPage()) return;
  modelValue.value = target;
  emit('change', {
    page: target
  });
};
const goNext = () => {
  if (canNext()) goToPage(currentPage() + 1);
};
const goPrev = () => {
  if (canPrev()) goToPage(currentPage() - 1);
};
const goFirst = () => goToPage(1);
const goLast = () => goToPage(effectivePages());

// ---- roving focus across the page controls -----------------------------
// Read $refs.nav only here / in handlers (post-mount → ROZ123-safe).
// querySelectorAll<HTMLElement> reaches the controls inside Lit's shadow root
// too; the generic gives `.focus()` (Element has no `.focus`, TS2339).
// ---- roving focus across the page controls -----------------------------
// Read $refs.nav only here / in handlers (post-mount → ROZ123-safe).
// querySelectorAll<HTMLElement> reaches the controls inside Lit's shadow root
// too; the generic gives `.focus()` (Element has no `.focus`, TS2339).
const controls = () => {
  const nav = navRef.value;
  if (!nav) return [];
  return Array.from(nav.querySelectorAll('[data-page-control]')) as HTMLElement[];
};
const focusControlAt = (idx: any) => {
  const els = controls();
  if (els.length === 0) return;
  let i = idx;
  if (i < 0) i = 0;
  if (i >= els.length) i = els.length - 1;
  const el = els[i];
  if (el && el.focus) el.focus();
};
const focusedIndex = () => {
  const els = controls();
  const nav = navRef.value;
  const active = nav ? nav.ownerDocument.activeElement : null;
  return els.indexOf(active as HTMLElement);
};

// Roving keyboard navigation: arrows move focus between controls, Home/End jump
// to the ends. Each control keeps tabindex via the template (the active page is
// 0, the rest -1) so the group is a single tab stop.
// Roving keyboard navigation: arrows move focus between controls, Home/End jump
// to the ends. Each control keeps tabindex via the template (the active page is
// 0, the rest -1) so the group is a single tab stop.
const onControlKeydown = ($event: any) => {
  if (props.disabled) return;
  const key = $event.key;
  const cur = focusedIndex();
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    $event.preventDefault();
    focusControlAt(cur + 1);
  } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
    $event.preventDefault();
    focusControlAt(cur - 1);
  } else if (key === 'Home') {
    $event.preventDefault();
    focusControlAt(0);
  } else if (key === 'End') {
    $event.preventDefault();
    focusControlAt(controls().length - 1);
  }
};

// ---- imperative handle -------------------------------------------------
// Consumer-callable verbs. `goto` clamps; `next`/`prev`/`first`/`last` are the
// bounds-aware steppers. None collide with an emit name (`change`) or the React
// model setter (`setModelValue`).
// ---- imperative handle -------------------------------------------------
// Consumer-callable verbs. `goto` clamps; `next`/`prev`/`first`/`last` are the
// bounds-aware steppers. None collide with an emit name (`change`) or the React
// model setter (`setModelValue`).
const goto = (page: any) => goToPage(page);
const next = () => goNext();
const prev = () => goPrev();
const first = () => goFirst();
const last = () => goLast();

defineExpose({ goto, next, prev, first, last });
</script>

<style scoped>
.rozie-pagination {
  display: inline-flex;
  align-items: center;
  gap: var(--rozie-pagination-gap, 0.25rem);
  font: var(--rozie-pagination-font, inherit);
}
.rozie-pagination-page,
.rozie-pagination-control {
  box-sizing: border-box;
  min-width: var(--rozie-pagination-size, 2.25rem);
  height: var(--rozie-pagination-size, 2.25rem);
  padding: 0 var(--rozie-pagination-padding-x, 0.5rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-weight: var(--rozie-pagination-font-weight, 500);
  color: var(--rozie-pagination-fg, #1a1a1a);
  background: var(--rozie-pagination-bg, transparent);
  border: var(--rozie-pagination-border-width, 1px) solid var(--rozie-pagination-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-pagination-radius, 6px);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-pagination-page:hover,
.rozie-pagination-control:hover {
  background: var(--rozie-pagination-hover-bg, rgba(0, 0, 0, 0.05));
  border-color: var(--rozie-pagination-hover-border, rgba(0, 0, 0, 0.28));
}
.rozie-pagination-page:focus-visible,
.rozie-pagination-control:focus-visible {
  outline: var(--rozie-pagination-ring-width, 2px) solid var(--rozie-pagination-ring, var(--rozie-pagination-accent, #0066cc));
  outline-offset: var(--rozie-pagination-ring-offset, 1px);
}
.rozie-pagination-page.is-active {
  color: var(--rozie-pagination-active-fg, #fff);
  background: var(--rozie-pagination-active-bg, var(--rozie-pagination-accent, #0066cc));
  border-color: var(--rozie-pagination-active-border, var(--rozie-pagination-accent, #0066cc));
}
.rozie-pagination-page:disabled,
.rozie-pagination-control:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-pagination-disabled-opacity, 0.5);
  pointer-events: none;
}
.rozie-pagination--disabled {
  opacity: var(--rozie-pagination-disabled-opacity, 0.5);
  pointer-events: none;
}
.rozie-pagination-ellipsis {
  min-width: var(--rozie-pagination-size, 2.25rem);
  height: var(--rozie-pagination-size, 2.25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--rozie-pagination-ellipsis-fg, rgba(0, 0, 0, 0.5));
  user-select: none;
}
</style>
