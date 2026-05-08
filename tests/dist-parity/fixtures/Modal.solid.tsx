import type { JSX } from 'solid-js';
import { Show, children, createEffect, onCleanup, onMount, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';
import Counter from './Counter';

interface HeaderSlotCtx { close: any; }

interface FooterSlotCtx { close: any; }

interface ModalProps {
  open?: boolean;
  defaultValue?: boolean;
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
}

export default function Modal(_props: ModalProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['open', 'closeOnEscape', 'closeOnBackdrop', 'lockBodyScroll', 'title', 'children']);
  const resolved = children(() => local.children);

  const [open, setOpen] = createControllableSignal(_props as Record<string, unknown>, 'open', false);
  onMount(() => {
    const _cleanup = (lockScroll)() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(unlockScroll);
  });
  onMount(() => {
    dialogElRef?.focus();
  });
  let backdropElRef: HTMLElement | null = null;
  let dialogElRef: HTMLElement | null = null;

  const close = () => {
    setOpen(false);
    _props.onClose?.();
  };

  // Body-scroll-lock state lives outside reactive data because it tracks DOM
  // rather than UI; managed entirely via lifecycle and listeners.
  // Body-scroll-lock state lives outside reactive data because it tracks DOM
  // rather than UI; managed entirely via lifecycle and listeners.
  let savedBodyOverflow = '';
  const lockScroll = () => {
    if (!local.lockBodyScroll) return;
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  };
  const unlockScroll = () => {
    if (!local.lockBodyScroll) return;
    document.body.style.overflow = savedBodyOverflow;
  };

  // Colocated lifecycle pair — runs in source order alongside other hooks.

  createEffect(() => {
    if (!(open() && local.closeOnEscape)) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
    };
    document.addEventListener('keydown', _rozieHandler);
    onCleanup(() => document.removeEventListener('keydown', _rozieHandler));
  });

  return (
    <>
    <style>{`.modal-backdrop {
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: var(--rozie-modal-z, 2000);
    }
    .modal-dialog {
      background: white;
      border-radius: 8px;
      min-width: 20rem;
      max-width: min(90vw, 40rem);
      max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      outline: none;
    }
    header, footer { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    header { border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
    header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
    footer { border-top: 1px solid rgba(0, 0, 0, 0.08); justify-content: flex-end; }
    .modal-body { padding: 1rem; overflow: auto; }
    .close-btn { background: none; border: none; cursor: pointer; font-size: 1.5rem; line-height: 1; }`}</style>
    <style>{`:root {
      --rozie-modal-z: 2000;
    }`}</style>
    <>
    {<Show when={open()}><div class={"modal-backdrop"} ref={(el) => { backdropElRef = el as HTMLElement; }} onClick={(e) => { if (e.target !== e.currentTarget) return; local.closeOnBackdrop && close(); }}>
      <div ref={(el) => { dialogElRef = el as HTMLElement; }} class={"modal-dialog"} role="dialog" aria-modal="true" aria-label={local.title || undefined} tabIndex={-1}>
        {<Show when={local.title || _props.headerSlot}><header>
          {_props.headerSlot ? _props.headerSlot({ close }) : <h2>{local.title}</h2>}
          <button aria-label="Close" class={"close-btn"} onClick={close}>×</button>
        </header></Show>}<div class={"modal-body"}>
          {resolved()}
          <Counter />
        </div>

        {<Show when={_props.footerSlot}><footer>
          {_props.footerSlot?.({ close })}
        </footer></Show>}</div>
    </div></Show>}</>
    </>
  );
}
