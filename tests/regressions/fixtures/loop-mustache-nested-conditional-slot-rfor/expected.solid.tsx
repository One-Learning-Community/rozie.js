import type { JSX } from 'solid-js';
import { For, Show, mergeProps, splitProps } from 'solid-js';

interface LoopMustacheNestedConditionalSlotRforProps extends Omit<import('solid-js').ComponentProps<'div'>, 'items' | 'slots' | 'children' | 'innerHTML' | 'innerText' | 'textContent' | 'ref'> {
  items?: any[];
  slots?: { [key: string]: ((...args: any[]) => JSX.Element) | undefined; };
}

export default function LoopMustacheNestedConditionalSlotRfor(_props: LoopMustacheNestedConditionalSlotRforProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['items', 'slots']);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-bc149f2f=""><For each={local.items}>{(x) => (<Show when={x}>{_props.slots?.[x]?.()}</Show>)}</For></div>
    </>
  );
}
