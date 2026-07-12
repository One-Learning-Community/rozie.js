import type { JSX } from 'solid-js';
import { For, Show, children, mergeProps, splitProps } from 'solid-js';

interface LoopMustacheNestedConditionalSlotRforProps {
  items?: any[];
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function LoopMustacheNestedConditionalSlotRfor(_props: LoopMustacheNestedConditionalSlotRforProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['items', 'children']);
  const resolved = children(() => local.children);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-bc149f2f=""><For each={local.items}>{(x) => (<Show when={x}>{typeof local.children === 'function' ? (local.children as (s: any) => any)({ name: x }) : resolved()}</Show>)}</For></div>
    </>
  );
}
