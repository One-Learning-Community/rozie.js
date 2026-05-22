import type { JSX } from 'solid-js';
import { children, splitProps } from 'solid-js';
import Inner from './inner';

interface WrapperProps {
  titleSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function Wrapper(_props: WrapperProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['children']);
  const resolved = children(() => local.children);

  return (
    <>
    <Inner headerSlot={() => (<>
        {(_props.titleSlot ?? _props.slots?.['title']?.({})) ?? "default title"}
      </>)}>{resolved() ?? "default body"}</Inner>
    </>
  );
}
