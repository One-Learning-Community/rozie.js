import type { JSX } from 'solid-js';
import { children, mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle, rozieClass } from '@rozie/runtime-solid';

__rozieInjectStyle('ElementPlusSlotFallthrough-986e3472', `.epsf-root[data-rozie-s-986e3472] {
  display: block;
  padding: 0.5rem;
  border: 1px solid #ddd;
}`);

interface ElementPlusSlotFallthroughProps {
  variant?: string;
  headerSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  footerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function ElementPlusSlotFallthrough(_props: ElementPlusSlotFallthroughProps): JSX.Element {
  const _merged = mergeProps({ variant: 'primary' }, _props);
  const [local, attrs] = splitProps(_merged, ['variant', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    {(_props.headerSlot ?? _props.slots?.['header']?.({}))}
    <div {...attrs} class={"epsf-root" + " " + rozieClass('epsf-root--' + local.variant) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-986e3472="">chrome</div>
    {resolved()}
    {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
    </>
  );
}
