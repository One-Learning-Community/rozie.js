import { useCallback, useState } from 'react';
import styles from './InlineExprHandler.module.css';

interface InlineExprHandlerProps {
  closeOnBackdrop?: boolean;
}

export default function InlineExprHandler(_props: InlineExprHandlerProps): JSX.Element {
  const props: InlineExprHandlerProps = {
    ..._props,
    closeOnBackdrop: _props.closeOnBackdrop ?? true,
  };
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
    <div className={styles.backdrop} onClick={(e) => { props.closeOnBackdrop && close(); }} data-rozie-s-8ec7623e="">
      
      <button onClick={close} data-rozie-s-8ec7623e="">Close</button>
    </div>
    </>
  );
}
