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
    reposition();
  });
  onMount(() => {});
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

  // Multiple $onMount calls run in source order. Useful for colocating setup
  // with the logic it serves.

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
    <style>{`.dropdown { position: relative; display: inline-block; }
    .dropdown-panel {
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
    <div class={"dropdown"}>
      <div ref={(el) => { triggerElRef = el as HTMLElement; }} onClick={toggle}>
        {_props.triggerSlot?.({ open: open(), toggle })}
      </div>

      {<Show when={open()}><div ref={(el) => { panelElRef = el as HTMLElement; }} class={"dropdown-panel"} role="menu">
        {resolved()}
      </div></Show>}</div>
    </>
    </>
  );
}
