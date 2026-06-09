import type { JSX } from 'solid-js';
import { Show, children, createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr } from '@rozie/runtime-solid';

__rozieInjectStyle('Modal-fc45feb2', `.modal-backdrop[data-rozie-s-fc45feb2] {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: var(--rozie-modal-z, 2000);
}
.modal-dialog[data-rozie-s-fc45feb2] {
  background: white;
  border-radius: 8px;
  min-width: 20rem;
  max-width: min(90vw, 40rem);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  outline: none;
}
header[data-rozie-s-fc45feb2], footer[data-rozie-s-fc45feb2] { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
header[data-rozie-s-fc45feb2] { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
header[data-rozie-s-fc45feb2] h2[data-rozie-s-fc45feb2] { flex: 1; margin: 0; font-size: 1.1rem; }
footer[data-rozie-s-fc45feb2] { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
.modal-body[data-rozie-s-fc45feb2] { padding: 1rem; overflow: auto; }
.close-btn[data-rozie-s-fc45feb2] { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }
:root {
  --rozie-modal-z: 2000;
}`);

interface HeaderSlotCtx { close: any; }

interface FooterSlotCtx { close: any; }

interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  onClose?: (...args: unknown[]) => void;
  headerSlot?: (ctx: HeaderSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  footerSlot?: (ctx: FooterSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function Modal(_props: ModalProps): JSX.Element {
  const _merged = mergeProps({ closeOnEscape: true, closeOnBackdrop: true, lockBodyScroll: true, title: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['open', 'closeOnEscape', 'closeOnBackdrop', 'lockBodyScroll', 'title', 'children']);
  const resolved = children(() => local.children);

  const [open, setOpen] = createControllableSignal<boolean>(_props as unknown as Record<string, unknown>, 'open', false);
  onMount(() => {
    const _cleanup = (lockScroll)() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(unlockScroll);
  });
  onMount(() => {
    dialogElRef?.focus();
  });
  createEffect(on(() => (() => open())(), (v) => untrack(() => ((isOpen: any) => {
    if (isOpen) lockScroll();else unlockScroll();
  })(v)), { defer: true }));
  let backdropElRef: HTMLElement | null = null;
  let dialogElRef: HTMLElement | null = null;

  function close() {
    setOpen(false);
    _props.onClose?.();
  }

  // Body-scroll-lock state lives outside reactive data because it tracks DOM
  // rather than UI; managed entirely via lifecycle and listeners.
  let savedBodyOverflow = '';
  function lockScroll() {
    if (!local.lockBodyScroll || !open()) return;
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    if (!local.lockBodyScroll) return;
    document.body.style.overflow = savedBodyOverflow;
  }

  // $watch re-fires on every `open` toggle — the cross-target primitive for
  // reacting to a prop change. The $onMount/$onUnmount pair anchors the
  // unmount-time restore; $onMount runs exactly once on every target (a
  // guarded no-op here) and must not be relied on to re-fire.

  createEffect(() => {
    if (!(open() && local.closeOnEscape)) return;
    const _rozieHandler = ($event: KeyboardEvent) => {
      if ($event.key !== 'Escape') return;
      close();
    };
    document.addEventListener('keydown', _rozieHandler);
    onCleanup(() => document.removeEventListener('keydown', _rozieHandler));
  });

  return (
    <>
    {<Show when={open()}><div class={"modal-backdrop"} ref={(el) => { backdropElRef = el as HTMLElement; }} onClick={($event) => { if ($event.target !== $event.currentTarget) return; local.closeOnBackdrop && close(); }} data-rozie-s-fc45feb2="">
      <div ref={(el) => { dialogElRef = el as HTMLElement; }} class={"modal-dialog"} role="dialog" aria-modal="true" aria-label={rozieAttr(local.title || undefined)} tabIndex={-1} data-rozie-s-fc45feb2="">
        {<Show when={local.title || (_props.headerSlot ?? _props.slots?.['header'])}><header data-rozie-s-fc45feb2="">
          {(_props.headerSlot ?? _props.slots?.['header'])?.({ close }) ?? <h2 data-rozie-s-fc45feb2="">{local.title}</h2>}
          <button aria-label="Close" class={"close-btn"} onClick={close} data-rozie-s-fc45feb2="">×</button>
        </header></Show>}<div class={"modal-body"} data-rozie-s-fc45feb2="">
          {typeof local.children === 'function' ? (local.children as (s: any) => any)({ close }) : resolved()}
        </div>

        {<Show when={(_props.footerSlot ?? _props.slots?.['footer'])}><footer data-rozie-s-fc45feb2="">
          {(_props.footerSlot ?? _props.slots?.['footer'])?.({ close })}
        </footer></Show>}</div>
    </div></Show>}</>
  );
}
