import type { JSX } from 'solid-js';
import { For, mergeProps, splitProps } from 'solid-js';

interface LoopMustacheTemplateSlotRforProps {
  items?: any[];
  slots?: { [key: string]: ((...args: any[]) => JSX.Element) | undefined; };
}

export default function LoopMustacheTemplateSlotRfor(_props: LoopMustacheTemplateSlotRforProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['items']);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-42e72e5a=""><For each={local.items}>{(x) => (_props.slots?.[x]?.())}</For></div>
    </>
  );
}
