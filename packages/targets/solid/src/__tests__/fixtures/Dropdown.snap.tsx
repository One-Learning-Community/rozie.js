import type { JSX } from 'solid-js';
import { Show, children, createEffect, mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { createControllableSignal, createOutsideClick, createThrottledHandler } from '@rozie/runtime-solid';

interface TriggerSlotCtx { open: any; toggle: any; }

interface DropdownProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  triggerSlot?: (ctx: TriggerSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
}

export default function Dropdown(_props: DropdownProps): JSX.Element {
  const _merged = mergeProps({ closeOnOutsideClick: true, closeOnEscape: true }, _props);
  const [local, rest] = splitProps(_merged, ['open', 'closeOnOutsideClick', 'closeOnEscape', 'children']);
  const resolved = children(() => local.children);

  const [open, setOpen] = createControllableSignal(_props as Record<string, unknown>, 'open', false);
  onMount(() => {
    // Initial reposition only if the panel is open at mount time.
    if (open()) reposition();
  });
  onMount(() => {});
  createEffect(() => { (() => open())(); (() => {
    if (open()) reposition();
  })(); });
  let triggerElRef: HTMLElement | null = null;
  let panelElRef: HTMLElement | null = null;

  const toggle = () => {
    setOpen(!open());
  };
  const close = () => {
    setOpen(false);
  };
  const reposition = () => {
    if (!panelElRef || !triggerElRef) return;
    const rect = triggerElRef.getBoundingClientRect();
    Object.assign(panelElRef.style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  };

  // Re-fire reposition() whenever the open transition flips on. The panel
  // element is r-if-gated, so $refs.panelEl is undefined at mount time — $watch
  // is the primitive that re-runs the effect after panel mount.

  const _rozieThrottleLReposition = createThrottledHandler(reposition, 100);

  createOutsideClick(
    [() => triggerElRef, () => panelElRef],
    close,
    () => open() && local.closeOnOutsideClick,
  );

  createEffect(() => {
    if (!(open() && local.closeOnEscape)) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
    };
    document.addEventListener('keydown', _rozieHandler);
    onCleanup(() => document.removeEventListener('keydown', _rozieHandler));
  });

  createEffect(() => {
    if (!(open())) return;
    window.addEventListener('resize', _rozieThrottleLReposition, { passive: true } as AddEventListenerOptions);
    onCleanup(() => window.removeEventListener('resize', _rozieThrottleLReposition, { passive: true } as AddEventListenerOptions));
  });

  return (
    <>
    <style>{`.dropdown[data-rozie-s-6d6bd882] { position: relative; display: inline-block; }
    .dropdown-panel[data-rozie-s-6d6bd882] {
      position: fixed;
      z-index: var(--rozie-dropdown-z, 1000);
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }`}</style>
    <style>{`:root {
      --rozie-dropdown-z: 1000;
    }`}</style>
    <>
    <div class={"dropdown"} data-rozie-s-6d6bd882="">
      <div ref={(el) => { triggerElRef = el as HTMLElement; }} onClick={toggle} data-rozie-s-6d6bd882="">
        {_props.triggerSlot?.({ open: open(), toggle })}
      </div>

      {<Show when={open()}><div ref={(el) => { panelElRef = el as HTMLElement; }} class={"dropdown-panel"} role="menu" data-rozie-s-6d6bd882="">
        {resolved()}
      </div></Show>}</div>
    </>
    </>
  );
}
