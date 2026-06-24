import type { JSX } from 'solid-js';
import { For, Show, mergeProps, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, mergeListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-solid';
import { paginationItems } from './internal/paginationItems';

// ---- derived view (ONE plain function, uniform x6) ---------------------
// The whole render model in a single call: { totalPages, page, pages,
// hasPrev, hasNext }. A PLAIN function (not $computed) so it reads uniformly
// on all six targets and can be aliased in handlers without the Solid
// accessor divergence. Returns a FRESH object each call — never feed it to a
// reference-equality $watch getter.

__rozieInjectStyle('Pagination-de247ae2', `.rozie-pagination[data-rozie-s-de247ae2] {
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
}`);

interface PrevControlSlotCtx { disabled: any; goto: any; page: any; }

interface EllipsisSlotCtx { index: any; }

interface ItemSlotCtx { page: any; selected: any; goto: any; }

interface NextControlSlotCtx { disabled: any; goto: any; page: any; }

interface PaginationProps {
  /**
   * The 1-based current page (two-way model). Clamped into `[1, totalPages]`. Bind it with `r-model:modelValue` / `v-model:modelValue` / `modelValue` + `onModelValueChange`; it is also the Angular ControlValueAccessor control value.
   */
  modelValue?: number;
  defaultModelValue?: number;
  onModelValueChange?: (modelValue: number) => void;
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
  onChange?: (...args: unknown[]) => void;
  prevControlSlot?: (ctx: PrevControlSlotCtx) => JSX.Element;
  ellipsisSlot?: (ctx: EllipsisSlotCtx) => JSX.Element;
  itemSlot?: (ctx: ItemSlotCtx) => JSX.Element;
  nextControlSlot?: (ctx: NextControlSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: PaginationHandle) => void;
}

export interface PaginationHandle {
  goto: (...args: any[]) => any;
  next: (...args: any[]) => any;
  prev: (...args: any[]) => any;
  first: (...args: any[]) => any;
  last: (...args: any[]) => any;
}

export default function Pagination(_props: PaginationProps): JSX.Element {
  const _merged = mergeProps({ totalPages: null, total: null, pageSize: null, siblingCount: 1, boundaryCount: 1, disabled: false, ariaLabel: 'Pagination' }, _props);
  const [local, attrs] = splitProps(_merged, ['modelValue', 'totalPages', 'total', 'pageSize', 'siblingCount', 'boundaryCount', 'disabled', 'ariaLabel', 'ref']);
  onMount(() => { local.ref?.({ goto, next, prev, first, last }); });

  const [modelValue, setModelValue] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'modelValue', 1);
  let navRef: HTMLElement | null = null;

  // ---- derived view (ONE plain function, uniform x6) ---------------------
  // The whole render model in a single call: { totalPages, page, pages,
  // hasPrev, hasNext }. A PLAIN function (not $computed) so it reads uniformly
  // on all six targets and can be aliased in handlers without the Solid
  // accessor divergence. Returns a FRESH object each call — never feed it to a
  // reference-equality $watch getter.
  function model() {
    return paginationItems({
      page: modelValue(),
      totalPages: local.totalPages,
      total: local.total,
      pageSize: local.pageSize,
      siblingCount: local.siblingCount,
      boundaryCount: local.boundaryCount
    });
  }

  // The resolved effective total page count (read in the template + handlers).
  // NAMED `effectivePages`, NOT `totalPages` — a `totalPages` helper would shadow
  // the `totalPages` PROP, which on Lit becomes a class field of type `number`
  // (hard TS2300/TS2717 against a `() => number` helper). The prop-name-collision
  // sibling of the otp `inputMode` gotcha.
  function effectivePages() {
    return model().totalPages;
  }
  // The clamped current page (the raw prop may be out of range).
  function currentPage() {
    return model().page;
  }
  function canPrev() {
    return model().hasPrev;
  }
  function canNext() {
    return model().hasNext;
  }
  function isActive(page: any) {
    return page === currentPage();
  }

  // Roving-tabindex value for a control: the active page is the single tab stop
  // (0), the rest are -1. The return type is annotated `number | undefined` ON
  // PURPOSE: the React emitter wraps every numeric `:attr` binding in
  // `(expr) ?? undefined`, and a PROVABLY non-null value (a bare `0`/`-1` or a
  // `0 : -1` ternary) trips TS2869 "right operand of ?? is unreachable". Routing
  // every tabindex through this nullable-typed helper keeps the `?? undefined`
  // reachable (the data-table cellTabindex precedent).
  function tabIndexFor(active: any): number | undefined {
    return active ? 0 : -1;
  }

  // ---- write funnel (single $emit site) ----------------------------------
  // Clamp to [1, totalPages], write the model, and emit `change` with the new
  // page. NOT named `setModelValue` (that collides with React's generated model
  // setter → ROZ524) — `goToPage` is collision-safe across all six leaves.
  function goToPage(page: any) {
    if (local.disabled) return;
    const tp = effectivePages();
    let target = typeof page === 'number' ? Math.floor(page) : 1;
    if (target < 1) target = 1;
    if (target > tp) target = tp;
    if (target === currentPage()) return;
    setModelValue(target);
    _props.onChange?.({
      page: target
    });
  }
  function goNext() {
    if (canNext()) goToPage(currentPage() + 1);
  }
  function goPrev() {
    if (canPrev()) goToPage(currentPage() - 1);
  }
  function goFirst() {
    return goToPage(1);
  }
  function goLast() {
    return goToPage(effectivePages());
  }

  // ---- roving focus across the page controls -----------------------------
  // Read $refs.nav only here / in handlers (post-mount → ROZ123-safe).
  // querySelectorAll<HTMLElement> reaches the controls inside Lit's shadow root
  // too; the generic gives `.focus()` (Element has no `.focus`, TS2339).
  function controls() {
    const nav = navRef;
    if (!nav) return [];
    return Array.from(nav.querySelectorAll('[data-page-control]')) as HTMLElement[];
  }
  function focusControlAt(idx: any) {
    const els = controls();
    if (els.length === 0) return;
    let i = idx;
    if (i < 0) i = 0;
    if (i >= els.length) i = els.length - 1;
    const el = els[i];
    if (el && el.focus) el.focus();
  }
  function focusedIndex() {
    const els = controls();
    const nav = navRef;
    const active = nav ? nav.ownerDocument.activeElement : null;
    return els.indexOf(active as HTMLElement);
  }

  // Roving keyboard navigation: arrows move focus between controls, Home/End jump
  // to the ends. Each control keeps tabindex via the template (the active page is
  // 0, the rest -1) so the group is a single tab stop.
  function onControlKeydown($event: any) {
    if (local.disabled) return;
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
  }

  // ---- imperative handle -------------------------------------------------
  // Consumer-callable verbs. `goto` clamps; `next`/`prev`/`first`/`last` are the
  // bounds-aware steppers. None collide with an emit name (`change`) or the React
  // model setter (`setModelValue`).
  function goto(page: any) {
    return goToPage(page);
  }
  function next() {
    return goNext();
  }
  function prev() {
    return goPrev();
  }
  function first() {
    return goFirst();
  }
  function last() {
    return goLast();
  }

  return (
    <>
    <nav classList={{ 'rozie-pagination--disabled': local.disabled }} ref={(el) => { navRef = el as HTMLElement; }} aria-label={local.ariaLabel} {...attrs} class={"rozie-pagination" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...mergeListeners({ onKeyDown: ($event) => { onControlKeydown($event); } }, attrs)} data-rozie-s-de247ae2="">
      
      {(_props.prevControlSlot ?? _props.slots?.['prevControl'])?.({ disabled: !canPrev() || local.disabled, goto: goPrev, page: currentPage() - 1 }) ?? <button type="button" data-page-control="" aria-disabled={!!(!canPrev() || local.disabled)} aria-label="Previous page" class={"rozie-pagination-control rozie-pagination-prev"} tabIndex={rozieAttr(tabIndexFor(true))} disabled={!canPrev() || local.disabled} onClick={goPrev} data-rozie-s-de247ae2="">‹</button>}

      
      <For each={model().pages}>{(item, index) => <>
        {<Show when={item === 'ellipsis'}><span class={"rozie-pagination-ellipsis"} aria-hidden="true" data-rozie-s-de247ae2="">
          {(_props.ellipsisSlot ?? _props.slots?.['ellipsis'])?.({ index: index() }) ?? "…"}
        </span></Show>}{<Show when={item !== 'ellipsis'}><span class={"rozie-pagination-item"} data-rozie-s-de247ae2="">
          {(_props.itemSlot ?? _props.slots?.['item'])?.({ page: item, selected: isActive(item), goto: () => goToPage(item) }) ?? <button type="button" data-page-control="" aria-disabled={!!local.disabled} aria-current={rozieAttr(isActive(item) ? 'page' : null)} aria-label={rozieAttr('Go to page ' + item)} class={"rozie-pagination-page"} classList={{ 'is-active': isActive(item) }} tabIndex={rozieAttr(tabIndexFor(isActive(item)))} disabled={!!local.disabled} onClick={($event) => { goToPage(item); }} data-rozie-s-de247ae2="">{rozieDisplay(item)}</button>}
        </span></Show>}</>}</For>

      
      {(_props.nextControlSlot ?? _props.slots?.['nextControl'])?.({ disabled: !canNext() || local.disabled, goto: goNext, page: currentPage() + 1 }) ?? <button type="button" data-page-control="" aria-disabled={!!(!canNext() || local.disabled)} aria-label="Next page" class={"rozie-pagination-control rozie-pagination-next"} tabIndex={rozieAttr(tabIndexFor(true))} disabled={!canNext() || local.disabled} onClick={goNext} data-rozie-s-de247ae2="">›</button>}
    </nav>
    </>
  );
}
