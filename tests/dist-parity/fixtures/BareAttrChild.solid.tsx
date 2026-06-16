import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';

interface BareAttrChildProps {
  combobox?: boolean;
}

export default function BareAttrChild(_props: BareAttrChildProps): JSX.Element {
  const _merged = mergeProps({ combobox: false }, _props);
  const [local, attrs] = splitProps(_merged, ['combobox']);

  return (
    <>
    <div data-combobox={local.combobox} {...attrs} class={"bare-attr-child" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f0cdfe8a="">
      combobox = {local.combobox}
    </div>
    </>
  );
}
