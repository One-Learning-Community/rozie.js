import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import BareAttrChild from './BareAttrChild';

interface BareAttrComponentProps {}

export default function BareAttrComponent(_props: BareAttrComponentProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <div {...attrs} class={"bare-attr-component" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-81da069c="">
      <BareAttrChild combobox={true} data-rozie-s-81da069c="" />
      <div hidden="" data-rozie-s-81da069c="" />
    </div>
    </>
  );
}
