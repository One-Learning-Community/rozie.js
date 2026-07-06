import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle, mergeListeners } from '@rozie/runtime-solid';

__rozieInjectStyle('InlineExprHandler-8ec7623e', `.backdrop[data-rozie-s-8ec7623e] { position: fixed; inset: 0; }`);

interface InlineExprHandlerProps {
  closeOnBackdrop?: boolean;
}

export default function InlineExprHandler(_props: InlineExprHandlerProps): JSX.Element {
  const _merged = mergeProps({ closeOnBackdrop: true }, _props);
  const [local, attrs] = splitProps(_merged, ['closeOnBackdrop']);

  const [open, setOpen] = createSignal(false);

  function close() {
    setOpen(false);
  }

  return (
    <>
    <div {...attrs} class={"backdrop" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...mergeListeners({ onClick: ($event: MouseEvent) => { local.closeOnBackdrop && close(); } }, attrs)} data-rozie-s-8ec7623e="">
      
      <button onClick={close} data-rozie-s-8ec7623e="">Close</button>
    </div>
    </>
  );
}
