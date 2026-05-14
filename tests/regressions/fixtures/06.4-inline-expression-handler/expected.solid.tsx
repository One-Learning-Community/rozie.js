import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';

interface InlineExprHandlerProps {
  closeOnBackdrop?: boolean;
}

export default function InlineExprHandler(_props: InlineExprHandlerProps): JSX.Element {
  const _merged = mergeProps({ closeOnBackdrop: true }, _props);
  const [local, rest] = splitProps(_merged, ['closeOnBackdrop']);

  const [open, setOpen] = createSignal(false);

  const close = () => {
    setOpen(false);
  };

  return (
    <>
    <style>{`.backdrop { position: fixed; inset: 0; }`}</style>
    <>
    <div class={"backdrop"} onClick={(e) => { local.closeOnBackdrop && close(); }}>
      
      <button onClick={close}>Close</button>
    </div>
    </>
    </>
  );
}
