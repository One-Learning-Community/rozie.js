import type { ReactNode } from 'react';
import { useControllableState } from '@rozie/runtime-react';
import Modal from './Modal';

interface WrapperModalProps {
  title?: string;
  open?: boolean;
  defaultValue?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderBrand?: ReactNode;
  children?: ReactNode;
  renderActions?: ReactNode;
}

export default function WrapperModal(_props: WrapperModalProps): JSX.Element {
  const props: WrapperModalProps = {
    ..._props,
    title: _props.title ?? 'Wrapped',
  };
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultValue ?? false,
    onValueChange: props.onOpenChange,
  });

  return (
    <>
    <Modal open={open} onOpenChange={onOpenChange} title={props.title} renderHeader={() => (<>
        {props.renderBrand ?? <h2 data-rozie-s-1efe6192="">{props.title}</h2>}
      </>)} renderFooter={() => (<>
        {props.renderActions}
      </>)} children={<>{props.children}</>} />
    </>
  );
}
