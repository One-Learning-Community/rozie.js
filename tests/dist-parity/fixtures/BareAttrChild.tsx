import { clsx } from '@rozie/runtime-react';

interface BareAttrChildProps {
  combobox?: boolean;
}

export default function BareAttrChild(_props: BareAttrChildProps): JSX.Element {
  const props: Omit<BareAttrChildProps, 'combobox'> & { combobox: boolean } = {
    ..._props,
    combobox: _props.combobox ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { combobox, ...rest } = _props as BareAttrChildProps & Record<string, unknown>;
    void combobox;
    return rest;
  })();

  return (
    <>
    <div data-combobox={props.combobox} {...attrs} className={clsx("bare-attr-child", (attrs.className as string | undefined))} data-rozie-s-f0cdfe8a="">
      combobox = {props.combobox}
    </div>
    </>
  );
}
