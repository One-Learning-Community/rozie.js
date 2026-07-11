import type { JSX } from 'solid-js';
import { For, children, mergeProps, splitProps } from 'solid-js';

interface LoopMustacheSlotRforProps {
  items?: any[];
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function LoopMustacheSlotRfor(_props: LoopMustacheSlotRforProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['items', 'children']);
  const resolved = children(() => local.children);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-caafe4dd=""><For each={local.items}>{(x) => (typeof local.children === 'function' ? (local.children as (s: any) => any)({ name: x }) : resolved())}</For></div>
    </>
  );
}
