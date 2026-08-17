import type { JSX } from 'solid-js';
import { For, mergeProps, splitProps } from 'solid-js';

interface LoopMustacheSlotRforProps {
  items?: any[];
  slots?: { [key: string]: ((...args: any[]) => JSX.Element) | undefined; };
}

export default function LoopMustacheSlotRfor(_props: LoopMustacheSlotRforProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['items']);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-caafe4dd=""><For each={local.items}>{(x) => (_props.slots?.[x]?.())}</For></div>
    </>
  );
}
