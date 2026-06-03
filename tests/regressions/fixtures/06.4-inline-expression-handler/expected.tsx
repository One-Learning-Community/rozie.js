import { useCallback, useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import './InlineExprHandler.css';

interface InlineExprHandlerProps {
  closeOnBackdrop?: boolean;
}

export default function InlineExprHandler(_props: InlineExprHandlerProps): JSX.Element {
  const props: Omit<InlineExprHandlerProps, 'closeOnBackdrop'> & { closeOnBackdrop: boolean } = {
    ..._props,
    closeOnBackdrop: _props.closeOnBackdrop ?? true,
  };
  const attrs: Record<string, unknown> = (() => {
    const { closeOnBackdrop, ...rest } = _props as InlineExprHandlerProps & Record<string, unknown>;
    void closeOnBackdrop;
    return rest;
  })();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
    <div {...attrs} className={clsx("backdrop", (attrs.className as string | undefined))} onClick={($event) => { props.closeOnBackdrop && close(); }} data-rozie-s-8ec7623e="">
      
      <button onClick={close} data-rozie-s-8ec7623e="">Close</button>
    </div>
    </>
  );
}
