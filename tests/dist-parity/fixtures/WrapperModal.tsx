import type { ReactNode } from 'react';
import { useControllableState } from '@rozie/runtime-react';
import Modal from './Modal';

interface WrapperModalProps {
  title?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderBrand?: () => ReactNode;
  children?: ReactNode;
  renderActions?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function WrapperModal(_props: WrapperModalProps): JSX.Element {
  const props: WrapperModalProps & { title: string } = {
    ..._props,
    title: _props.title ?? 'Wrapped',
  };
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultOpen ?? false,
    onValueChange: props.onOpenChange,
  });

  return (
    <>
    <Modal open={open} onOpenChange={setOpen} title={props.title} renderHeader={() => (<>
        {(props.renderBrand ?? props.slots?.['brand']) ? ((props.renderBrand ?? props.slots?.['brand']) as Function)() : <h2 data-rozie-s-1efe6192="">{props.title}</h2>}
      </>)} renderFooter={() => (<>
        {(props.renderActions ?? props.slots?.['actions'])?.()}
      </>)} children={<>{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}</>} />
    </>
  );
}
