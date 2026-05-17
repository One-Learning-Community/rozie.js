import type { JSX } from 'solid-js';
import { children, mergeProps, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';
import Modal from './Modal';

interface WrapperModalProps {
  title?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  brandSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  actionsSlot?: JSX.Element;
}

export default function WrapperModal(_props: WrapperModalProps): JSX.Element {
  const _merged = mergeProps({ title: 'Wrapped' }, _props);
  const [local, rest] = splitProps(_merged, ['title', 'open', 'children']);
  const resolved = children(() => local.children);

  const [open, setOpen] = createControllableSignal(_props as Record<string, unknown>, 'open', false);

  return (
    <>
    <Modal open={open()} onOpenChange={setOpen} title={local.title} headerSlot={() => (<>
        {_props.brandSlot ?? <h2 data-rozie-s-1efe6192="">{local.title}</h2>}
      </>)} footerSlot={() => (<>
        {_props.actionsSlot}
      </>)}>{resolved()}</Modal>
    </>
  );
}
