import { clsx } from '@rozie/runtime-react';
import BareAttrChild from './BareAttrChild';

interface BareAttrComponentProps {}

export default function BareAttrComponent(props: BareAttrComponentProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx("bare-attr-component", (attrs.className as string | undefined))} data-rozie-s-81da069c="">
      <BareAttrChild combobox={true} data-rozie-s-81da069c="" />
      <div hidden={true} data-rozie-s-81da069c="" />
    </div>
    </>
  );
}
