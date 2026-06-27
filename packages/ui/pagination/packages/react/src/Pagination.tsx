import { Fragment, forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Pagination.css';
import { paginationItems } from './internal/paginationItems';

// ---- derived view (ONE plain function, uniform x6) ---------------------
// The whole render model in a single call: { totalPages, page, pages,
// hasPrev, hasNext }. A PLAIN function (not $computed) so it reads uniformly
// on all six targets and can be aliased in handlers without the Solid
// accessor divergence. Returns a FRESH object each call — never feed it to a
// reference-equality $watch getter.

interface PrevControlCtx { disabled: any; goto: any; page: any; }

interface EllipsisCtx { index: any; }

interface ItemCtx { page: any; selected: any; goto: any; }

interface NextControlCtx { disabled: any; goto: any; page: any; }

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
  onChange?: (...args: any[]) => void;
  renderPrevControl?: (ctx: PrevControlCtx) => ReactNode;
  renderEllipsis?: (ctx: EllipsisCtx) => ReactNode;
  renderItem?: (ctx: ItemCtx) => ReactNode;
  renderNextControl?: (ctx: NextControlCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface PaginationHandle {
  goto: (...args: any[]) => any;
  next: (...args: any[]) => any;
  prev: (...args: any[]) => any;
  first: (...args: any[]) => any;
  last: (...args: any[]) => any;
}

const Pagination = forwardRef<PaginationHandle, PaginationProps>(function Pagination(_props: PaginationProps, ref): JSX.Element {
  const props: Omit<PaginationProps, 'totalPages' | 'total' | 'pageSize' | 'siblingCount' | 'boundaryCount' | 'disabled' | 'ariaLabel'> & { totalPages: (number) | null; total: (number) | null; pageSize: (number) | null; siblingCount: number; boundaryCount: number; disabled: boolean; ariaLabel: string } = {
    ..._props,
    totalPages: _props.totalPages ?? null,
    total: _props.total ?? null,
    pageSize: _props.pageSize ?? null,
    siblingCount: _props.siblingCount ?? 1,
    boundaryCount: _props.boundaryCount ?? 1,
    disabled: _props.disabled ?? false,
    ariaLabel: _props.ariaLabel ?? 'Pagination',
  };
  const attrs: Record<string, unknown> = (() => {
    const { modelValue, totalPages, total, pageSize, siblingCount, boundaryCount, disabled, ariaLabel, defaultValue, onModelValueChange, defaultModelValue, ...rest } = _props as PaginationProps & Record<string, unknown>;
    void modelValue; void totalPages; void total; void pageSize; void siblingCount; void boundaryCount; void disabled; void ariaLabel; void defaultValue; void onModelValueChange; void defaultModelValue;
    return rest;
  })();
  const [modelValue, setModelValue] = useControllableState({
    value: props.modelValue,
    defaultValue: props.defaultModelValue ?? 1,
    onValueChange: props.onModelValueChange,
  });
  const nav = useRef<HTMLElement | null>(null);

  function model() {
    return paginationItems({
      page: modelValue,
      totalPages: props.totalPages,
      total: props.total,
      pageSize: props.pageSize,
      siblingCount: props.siblingCount,
      boundaryCount: props.boundaryCount
    });
  }
  function effectivePages() {
    return model().totalPages;
  }
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
  function tabIndexFor(active: any): number | undefined {
    return active ? 0 : -1;
  }
  const { onChange: _rozieProp_onChange } = props;
    const goToPage = useCallback((page: any) => {
    if (props.disabled) return;
    const tp = effectivePages();
    let target = typeof page === 'number' ? Math.floor(page) : 1;
    if (target < 1) target = 1;
    if (target > tp) target = tp;
    if (target === currentPage()) return;
    setModelValue(target);
    _rozieProp_onChange && _rozieProp_onChange({
      page: target
    });
  }, [_rozieProp_onChange, currentPage, effectivePages, props.disabled, setModelValue]);
  const goNext = useCallback(() => {
    if (canNext()) goToPage(currentPage() + 1);
  }, [canNext, currentPage, goToPage]);
  const goPrev = useCallback(() => {
    if (canPrev()) goToPage(currentPage() - 1);
  }, [canPrev, currentPage, goToPage]);
  function goFirst() {
    return goToPage(1);
  }
  function goLast() {
    return goToPage(effectivePages());
  }
  function controls() {
    const nav$local = nav.current;
    if (!nav$local) return [];
    return Array.from(nav$local.querySelectorAll('[data-page-control]')) as HTMLElement[];
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
    const nav$local = nav.current;
    const active = nav$local ? nav$local.ownerDocument.activeElement : null;
    return els.indexOf(active as HTMLElement);
  }
  const onControlKeydown = useCallback(($event: any) => {
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
  }, [controls, focusControlAt, focusedIndex, props.disabled]);
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

  const _rozieExposeRef = useRef({ goto, next, prev, first, last });
  _rozieExposeRef.current = { goto, next, prev, first, last };
  useImperativeHandle(ref, () => ({ goto: (...args: Parameters<typeof goto>): ReturnType<typeof goto> => _rozieExposeRef.current.goto(...args), next: (...args: Parameters<typeof next>): ReturnType<typeof next> => _rozieExposeRef.current.next(...args), prev: (...args: Parameters<typeof prev>): ReturnType<typeof prev> => _rozieExposeRef.current.prev(...args), first: (...args: Parameters<typeof first>): ReturnType<typeof first> => _rozieExposeRef.current.first(...args), last: (...args: Parameters<typeof last>): ReturnType<typeof last> => _rozieExposeRef.current.last(...args) }), []);

  return (
    <>
    <nav ref={nav} aria-label={props.ariaLabel} {...attrs} className={clsx(clsx("rozie-pagination", { "rozie-pagination--disabled": props.disabled }), (attrs.className as string | undefined))} onKeyDown={($event) => { onControlKeydown($event); }} data-rozie-s-de247ae2="">
      
      {(props.renderPrevControl ?? props.slots?.['prevControl']) ? ((props.renderPrevControl ?? props.slots?.['prevControl']) as Function)({ disabled: !canPrev() || props.disabled, goto: goPrev, page: currentPage() - 1 }) : <button type="button" className={"rozie-pagination-control rozie-pagination-prev"} data-page-control="" tabIndex={tabIndexFor(true)} disabled={!canPrev() || props.disabled} aria-disabled={!!(!canPrev() || props.disabled)} aria-label="Previous page" onClick={goPrev} data-rozie-s-de247ae2="">‹</button>}

      
      {model().pages.map((item, index) => <Fragment key={item + '-' + index}>
        {(item === 'ellipsis') && <span key={item + '-' + index} className={"rozie-pagination-ellipsis"} aria-hidden="true" data-rozie-s-de247ae2="">
          {(props.renderEllipsis ?? props.slots?.['ellipsis']) ? ((props.renderEllipsis ?? props.slots?.['ellipsis']) as Function)({ index }) : "…"}
        </span>}{(item !== 'ellipsis') && <span key={item + '-' + index} className={"rozie-pagination-item"} data-rozie-s-de247ae2="">
          {(props.renderItem ?? props.slots?.['item']) ? ((props.renderItem ?? props.slots?.['item']) as Function)({ page: item, selected: isActive(item), goto: () => goToPage(item) }) : <button type="button" className={clsx("rozie-pagination-page", { "is-active": isActive(item) })} data-page-control="" tabIndex={tabIndexFor(isActive(item))} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-current={rozieAttr(isActive(item) ? 'page' : undefined)} aria-label={rozieAttr('Go to page ' + item)} onClick={($event) => { goToPage(item); }} data-rozie-s-de247ae2="">{rozieDisplay(item)}</button>}
        </span>}</Fragment>)}

      
      {(props.renderNextControl ?? props.slots?.['nextControl']) ? ((props.renderNextControl ?? props.slots?.['nextControl']) as Function)({ disabled: !canNext() || props.disabled, goto: goNext, page: currentPage() + 1 }) : <button type="button" className={"rozie-pagination-control rozie-pagination-next"} data-page-control="" tabIndex={tabIndexFor(true)} disabled={!canNext() || props.disabled} aria-disabled={!!(!canNext() || props.disabled)} aria-label="Next page" onClick={goNext} data-rozie-s-de247ae2="">›</button>}
    </nav>
    </>
  );
});
export default Pagination;
