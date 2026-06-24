import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, useControllableState, useOutsideClick } from '@rozie/runtime-react';
import './Popover.css';
// The `offset` AND `arrow` middleware factories are ALIASED on import: both are
// ALSO author PROP names (`offset`, `arrow`). A bare `offset`/`arrow` shorthand in
// the buildMiddleware factories object resolves to the PROP — on Vue/Svelte the
// destructured prop local shadows the import, and on Angular the emitter rewrites
// the bare shorthand to the prop signal (`offset: this.offset()`, a number) instead
// of the middleware function (TS2322). Aliasing both severs the import↔prop clash.
// (The Cropper import-name==component-name class, applied to imports vs PROP names —
// two collisions, not one.) computePosition/autoUpdate/flip/shift carry no clash.
import { computePosition, autoUpdate, offset as offsetMiddleware, flip, shift, arrow as arrowMiddleware } from '@floating-ui/dom';
import { buildMiddleware } from './internal/middleware';

// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
//   anchorNode/floatingNode/arrowNode hold the resolved ref ELEMENTS (read ONLY in
//   $onMount/handlers, ROZ123). They are deliberately named DIFFERENTLY from the
//   `ref="anchorEl"` / `ref="floatingEl"` / `ref="arrowEl"` template ref names: the
//   React/Svelte emitters declare a `const anchorEl = useRef(...)` for the ref, and a
//   top-level `let anchorEl` hoisted to its own `useRef` would REDECLARE it (TS2451 —
//   the local-name==ref-name self-shadow class, here in its `let X = null; X = $refs.X`
//   variant, which deconflictRefShadows does NOT auto-rewrite since it only fires on the
//   `const X = $refs.X` init shape).
//   stopAutoUpdate is the autoUpdate teardown handle — a TOP-LEVEL `let` so the Solid
//   onMount→onCleanup split (teardown is a separate closure) can still see it.

interface AnchorCtx { open: any; toggle: any; show: any; hide: any; }

interface PopoverProps {
  /**
   * Whether the floating content is open. The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Popover writes the new state back whenever the trigger or a dismissal toggles it. Left unbound it falls back to an uncontrolled default.
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Floating UI placement of the content relative to the anchor — one of `top`/`right`/`bottom`/`left`, each optionally suffixed `-start`/`-end` (e.g. `bottom-start`). With `disableFlip` off, the content may flip to the opposite side when it would overflow the viewport. Reconciled at runtime.
   */
  placement?: string;
  /**
   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur. Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog).
   */
  trigger?: string;
  /**
   * Distance in pixels between the anchor and the floating content (the Floating UI `offset` middleware). Reconciled at runtime.
   */
  offset?: number;
  /**
   * Disable the Floating UI `flip` middleware. By default the content flips to the opposite side of the anchor when it would overflow the viewport; set this to keep it pinned to `placement` regardless.
   */
  disableFlip?: boolean;
  /**
   * Disable the Floating UI `shift` middleware. By default the content shifts along its axis to stay within the viewport; set this to keep it strictly aligned to the anchor.
   */
  disableShift?: boolean;
  /**
   * Opt in to a positioned arrow element. When set, Popover renders an arrow `<div>` and runs the Floating UI `arrow` middleware against it so it points at the anchor. Style it via the `--rozie-popover-*` arrow CSS custom properties.
   */
  arrow?: boolean;
  /**
   * Disable the control entirely: the trigger no longer opens the content and any open content is suppressed.
   */
  disabled?: boolean;
  onChange?: (...args: any[]) => void;
  renderAnchor?: (ctx: AnchorCtx) => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface PopoverHandle {
  show: (...args: any[]) => any;
  hide: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  reposition: (...args: any[]) => any;
}

const Popover = forwardRef<PopoverHandle, PopoverProps>(function Popover(_props: PopoverProps, ref): JSX.Element {
  const props: Omit<PopoverProps, 'placement' | 'trigger' | 'offset' | 'disableFlip' | 'disableShift' | 'arrow' | 'disabled'> & { placement: string; trigger: string; offset: number; disableFlip: boolean; disableShift: boolean; arrow: boolean; disabled: boolean } = {
    ..._props,
    placement: _props.placement ?? 'bottom',
    trigger: _props.trigger ?? 'click',
    offset: _props.offset ?? 8,
    disableFlip: _props.disableFlip ?? false,
    disableShift: _props.disableShift ?? false,
    arrow: _props.arrow ?? false,
    disabled: _props.disabled ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, placement, trigger, offset, disableFlip, disableShift, arrow, disabled, defaultValue, onOpenChange, defaultOpen, ...rest } = _props as PopoverProps & Record<string, unknown>;
    void open; void placement; void trigger; void offset; void disableFlip; void disableShift; void arrow; void disabled; void defaultValue; void onOpenChange; void defaultOpen;
    return rest;
  })();
  const anchorNode = useRef<any>(null);
  const floatingNode = useRef<any>(null);
  const arrowNode = useRef<any>(null);
  const stopAutoUpdate = useRef<any>(null);
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultOpen ?? false,
    onValueChange: props.onOpenChange,
  });
  const _openRef = useRef(open);
  _openRef.current = open;
  const anchorEl = useRef<HTMLDivElement | null>(null);
  const floatingEl = useRef<HTMLDivElement | null>(null);
  const arrowEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);

  function requestOpen(next: any) {
    if (open === next) return;
    setOpen(next);
    props.onChange && props.onChange(next);
  }
  function applyPosition(x: any, y: any, middlewareData: any) {
    if (!floatingNode.current) return;
    floatingNode.current.style.left = x + 'px';
    floatingNode.current.style.top = y + 'px';
    if (arrowNode.current && middlewareData && middlewareData.arrow) {
      const ax = middlewareData.arrow.x;
      const ay = middlewareData.arrow.y;
      arrowNode.current.style.left = ax == null ? '' : ax + 'px';
      arrowNode.current.style.top = ay == null ? '' : ay + 'px';
    }
  }
  function position() {
    if (!anchorNode.current || !floatingNode.current) return;
    const middleware = buildMiddleware({
      offset: offsetMiddleware,
      flip,
      shift,
      arrow: arrowMiddleware
    }, {
      offset: props.offset,
      disableFlip: props.disableFlip,
      disableShift: props.disableShift,
      arrow: props.arrow,
      arrowEl: arrowNode.current
    });
    let opts: any = null;
    opts = {
      placement: props.placement,
      middleware
    };
    computePosition(anchorNode.current, floatingNode.current, opts).then((result: any) => {
      applyPosition(result.x, result.y, result.middlewareData);
    });
  }
  const startTracking = useCallback(() => {
    if (!anchorNode.current || !floatingNode.current) return;
    if (stopAutoUpdate.current) {
      stopAutoUpdate.current();
      stopAutoUpdate.current = null;
    }
    stopAutoUpdate.current = autoUpdate(anchorNode.current, floatingNode.current, position);
  }, [position]);
  const stopTracking = useCallback(() => {
    if (stopAutoUpdate.current) {
      stopAutoUpdate.current();
      stopAutoUpdate.current = null;
    }
  }, []);
  const onAnchorClick = useCallback(() => {
    if (props.disabled) return;
    requestOpen(!open);
  }, [open, props.disabled, requestOpen]);
  const onAnchorPointerEnter = useCallback(() => {
    if (props.disabled) return;
    requestOpen(true);
  }, [props.disabled, requestOpen]);
  const onAnchorPointerLeave = useCallback(() => {
    if (props.disabled) return;
    requestOpen(false);
  }, [props.disabled, requestOpen]);
  const onAnchorFocus = useCallback(() => {
    if (props.disabled) return;
    requestOpen(true);
  }, [props.disabled, requestOpen]);
  const onAnchorBlur = useCallback(() => {
    if (props.disabled) return;
    requestOpen(false);
  }, [props.disabled, requestOpen]);
  const dismiss = useCallback(() => {
    requestOpen(false);
  }, [requestOpen]);
  function isTooltip() {
    return props.trigger === 'hover' || props.trigger === 'focus';
  }
  function floatingRole() {
    return isTooltip() ? 'tooltip' : 'dialog';
  }
  // ─── imperative handle ($expose) ────────────────────────────────────────────────
  // Verbs: show/hide/toggle/reposition. NOT `update` (reserved Lit lifecycle) → the
  // reposition verb is `reposition`. None collide with the `change` emit, the `open`
  // model, or its React `setOpen` setter, nor with inherited HTMLElement members.
  function show() {
    if (!props.disabled) requestOpen(true);
  }
  function hide() {
    requestOpen(false);
  }
  function toggle() {
    if (!props.disabled) requestOpen(!open);
  }
  function reposition() {
    position();
  }

  useEffect(() => {
    // $refs read ONLY here (ROZ123). The floating + arrow elements live behind r-if
    // and may be null until open; startTracking re-reads via the watch path.
    anchorNode.current = anchorEl.current;
    if (_openRef.current && !props.disabled) {
      // floatingNode is populated by its r-if having rendered; read it lazily inside
      // the watch/handlers too. Position on next tick when it exists.
      floatingNode.current = floatingEl.current;
      arrowNode.current = arrowEl.current;
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const isOpen = open;
    if (isOpen && !props.disabled) {
      floatingNode.current = floatingEl.current;
      arrowNode.current = arrowEl.current;
      startTracking();
    } else {
      stopTracking();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (open) position();
  }, [props.placement]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    if (open) position();
  }, [props.offset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    if (open) position();
  }, [props.disableFlip]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    if (open) position();
  }, [props.disableShift]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!(open)) return;
    const _rozieHandler = ($event: KeyboardEvent) => {
      if ($event.key !== 'Escape') return;
      ((dismiss) as ((...args: any[]) => any))($event);
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [dismiss, open]);

  useOutsideClick(
    [anchorEl, floatingEl],
    dismiss,
    () => !!(open),
  );

  const _rozieExposeRef = useRef({ show, hide, toggle, reposition });
  _rozieExposeRef.current = { show, hide, toggle, reposition };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), hide: (...args: Parameters<typeof hide>): ReturnType<typeof hide> => _rozieExposeRef.current.hide(...args), toggle: (...args: Parameters<typeof toggle>): ReturnType<typeof toggle> => _rozieExposeRef.current.toggle(...args), reposition: (...args: Parameters<typeof reposition>): ReturnType<typeof reposition> => _rozieExposeRef.current.reposition(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx("rozie-popover", (attrs.className as string | undefined))} data-rozie-s-c6cf02ea="">

      
      <div className={"rozie-popover-anchor"} ref={anchorEl} aria-haspopup="dialog" aria-expanded={!!open} aria-describedby={rozieAttr(isTooltip() && open ? 'rozie-popover-floating' : undefined)} onClick={($event) => { props.trigger === 'click' && onAnchorClick(); }} onPointerEnter={($event) => { props.trigger === 'hover' && onAnchorPointerEnter(); }} onPointerLeave={($event) => { props.trigger === 'hover' && onAnchorPointerLeave(); }} onFocus={($event) => { props.trigger === 'focus' && onAnchorFocus(); }} onBlur={($event) => { props.trigger === 'focus' && onAnchorBlur(); }} data-rozie-s-c6cf02ea="">
        {(props.renderAnchor ?? props.slots?.['anchor'])?.({ open, toggle, show, hide })}
      </div>

      
      {(open && !props.disabled) && <div className={"rozie-popover-floating"} ref={floatingEl} id="rozie-popover-floating" role={rozieAttr(floatingRole())} aria-modal={!!(floatingRole() === 'dialog')} data-rozie-s-c6cf02ea="">
        {(props.arrow) && <div className={"rozie-popover-arrow"} ref={arrowEl} data-rozie-s-c6cf02ea="" />}{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
      </div>}</div>
    </>
  );
});
export default Popover;
