<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  /**
   * The 1-based current page (two-way model). Clamped into `[1, totalPages]`. Bind it with `r-model:modelValue` / `v-model:modelValue` / `modelValue` + `onModelValueChange`; it is also the Angular ControlValueAccessor control value.
   */
  modelValue?: number;
  /**
   * Explicit total page count. When provided (> 0) it takes precedence over `total` + `pageSize`. Use it when the backend already reports the page count.
   */
  totalPages?: (number) | null;
  /**
   * Total item count. Combined with `pageSize` to derive the page count (`ceil(total / pageSize)`) when `totalPages` is not given.
   */
  total?: (number) | null;
  /**
   * Items per page. Combined with `total` to derive the page count when `totalPages` is not given.
   */
  pageSize?: (number) | null;
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
  prevControl?: Snippet<[{ disabled: any; goto: any; page: any }]>;
  ellipsis?: Snippet<[{ index: any }]>;
  item?: Snippet<[{ page: any; selected: any; goto: any }]>;
  nextControl?: Snippet<[{ disabled: any; goto: any; page: any }]>;
  snippets?: Record<string, any>;
  onchange?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let {
  modelValue = $bindable(1),
  totalPages = null,
  total = null,
  pageSize = null,
  siblingCount = 1,
  boundaryCount = 1,
  disabled = false,
  ariaLabel = 'Pagination',
  prevControl: __prevControlProp,
  ellipsis: __ellipsisProp,
  item: __itemProp,
  nextControl: __nextControlProp,
  snippets,
  onchange,
  ...__rozieAttrs
}: Props = $props();

const prevControl = $derived(__prevControlProp ?? snippets?.prevControl);
const ellipsis = $derived(__ellipsisProp ?? snippets?.ellipsis);
const item$$slot = $derived(__itemProp ?? snippets?.item);
const nextControl = $derived(__nextControlProp ?? snippets?.nextControl);

let nav = $state<HTMLElement | undefined>(undefined);

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
  page: modelValue,
  totalPages: totalPages,
  total: total,
  pageSize: pageSize,
  siblingCount: siblingCount,
  boundaryCount: boundaryCount
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
  if (disabled) return;
  const tp = effectivePages();
  let target = typeof page === 'number' ? Math.floor(page) : 1;
  if (target < 1) target = 1;
  if (target > tp) target = tp;
  if (target === currentPage()) return;
  modelValue = target;
  onchange?.({
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
  const nav$local = nav;
  if (!nav$local) return [];
  return Array.from(nav$local.querySelectorAll('[data-page-control]')) as HTMLElement[];
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
  const nav$local = nav;
  const active = nav$local ? nav$local.ownerDocument.activeElement : null;
  return els.indexOf(active as HTMLElement);
};

// Roving keyboard navigation: arrows move focus between controls, Home/End jump
// to the ends. Each control keeps tabindex via the template (the active page is
// 0, the rest -1) so the group is a single tab stop.
// Roving keyboard navigation: arrows move focus between controls, Home/End jump
// to the ends. Each control keeps tabindex via the template (the active page is
// 0, the rest -1) so the group is a single tab stop.
const onControlKeydown = ($event: any) => {
  if (disabled) return;
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
export const goto = (page: any) => goToPage(page);
export const next = () => goNext();
export const prev = () => goPrev();
export const first = () => goFirst();
export const last = () => goLast();
</script>

<nav bind:this={nav} aria-label={ariaLabel} {...__rozieAttrs} class={["rozie-pagination", { 'rozie-pagination--disabled': disabled }, (__rozieAttrs)?.class]} onkeydown={($event) => { onControlKeydown($event); }} use:applyListeners={__rozieAttrs} data-rozie-s-de247ae2>{#if prevControl}{@render prevControl({ disabled: !canPrev() || disabled, goto: goPrev, page: currentPage() - 1 })}{:else}<button type="button" class="rozie-pagination-control rozie-pagination-prev" data-page-control="" tabindex={rozieAttr(tabIndexFor(true))} disabled={!canPrev() || disabled} aria-disabled={!!(!canPrev() || disabled)} aria-label="Previous page" onclick={goPrev} data-rozie-s-de247ae2>‹</button>{/if}{#each model().pages as item, index (item + '-' + index)}{#if item === 'ellipsis'}<span class="rozie-pagination-ellipsis" aria-hidden="true" data-rozie-s-de247ae2>{#if ellipsis}{@render ellipsis({ index })}{:else}…{/if}</span>{/if}{#if item !== 'ellipsis'}<span class="rozie-pagination-item" data-rozie-s-de247ae2>{#if item$$slot}{@render item$$slot({ page: item, selected: isActive(item), goto: () => goToPage(item) })}{:else}<button type="button" class={["rozie-pagination-page", { 'is-active': isActive(item) }]} data-page-control="" tabindex={rozieAttr(tabIndexFor(isActive(item)))} disabled={!!disabled} aria-disabled={!!disabled} aria-current={rozieAttr(isActive(item) ? 'page' : null)} aria-label={rozieAttr('Go to page ' + item)} onclick={($event) => { goToPage(item); }} data-rozie-s-de247ae2>{rozieDisplay(item)}</button>{/if}</span>{/if}{/each}{#if nextControl}{@render nextControl({ disabled: !canNext() || disabled, goto: goNext, page: currentPage() + 1 })}{:else}<button type="button" class="rozie-pagination-control rozie-pagination-next" data-page-control="" tabindex={rozieAttr(tabIndexFor(true))} disabled={!canNext() || disabled} aria-disabled={!!(!canNext() || disabled)} aria-label="Next page" onclick={goNext} data-rozie-s-de247ae2>›</button>{/if}</nav>

<style>
:global {
  .rozie-pagination[data-rozie-s-de247ae2] {
    display: inline-flex;
    align-items: center;
    gap: var(--rozie-pagination-gap, 0.25rem);
    font: var(--rozie-pagination-font, inherit);
  }
  .rozie-pagination-page[data-rozie-s-de247ae2],
  .rozie-pagination-control[data-rozie-s-de247ae2] {
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
  .rozie-pagination-page[data-rozie-s-de247ae2]:hover,
  .rozie-pagination-control[data-rozie-s-de247ae2]:hover {
    background: var(--rozie-pagination-hover-bg, rgba(0, 0, 0, 0.05));
    border-color: var(--rozie-pagination-hover-border, rgba(0, 0, 0, 0.28));
  }
  .rozie-pagination-page[data-rozie-s-de247ae2]:focus-visible,
  .rozie-pagination-control[data-rozie-s-de247ae2]:focus-visible {
    outline: var(--rozie-pagination-ring-width, 2px) solid var(--rozie-pagination-ring, var(--rozie-pagination-accent, #0066cc));
    outline-offset: var(--rozie-pagination-ring-offset, 1px);
  }
  .rozie-pagination-page.is-active[data-rozie-s-de247ae2] {
    color: var(--rozie-pagination-active-fg, #fff);
    background: var(--rozie-pagination-active-bg, var(--rozie-pagination-accent, #0066cc));
    border-color: var(--rozie-pagination-active-border, var(--rozie-pagination-accent, #0066cc));
  }
  .rozie-pagination-page[data-rozie-s-de247ae2]:disabled,
  .rozie-pagination-control[data-rozie-s-de247ae2]:disabled {
    cursor: not-allowed;
    opacity: var(--rozie-pagination-disabled-opacity, 0.5);
    pointer-events: none;
  }
  .rozie-pagination--disabled[data-rozie-s-de247ae2] {
    opacity: var(--rozie-pagination-disabled-opacity, 0.5);
    pointer-events: none;
  }
  .rozie-pagination-ellipsis[data-rozie-s-de247ae2] {
    min-width: var(--rozie-pagination-size, 2.25rem);
    height: var(--rozie-pagination-size, 2.25rem);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--rozie-pagination-ellipsis-fg, rgba(0, 0, 0, 0.5));
    user-select: none;
  }
}
</style>
