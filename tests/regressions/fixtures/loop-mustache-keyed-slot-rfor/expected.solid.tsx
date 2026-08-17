import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';

interface LoopMustacheKeyedSlotRforProps {
  rows?: any[];
  slots?: { [key: string]: ((...args: any[]) => JSX.Element) | undefined; };
}

export default function LoopMustacheKeyedSlotRfor(_props: LoopMustacheKeyedSlotRforProps): JSX.Element {
  const _merged = mergeProps({ rows: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['rows']);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-10bfe9b6=""><Key each={local.rows as readonly any[]} by={(row) => row.id}>{(row) => (_props.slots?.[row()]?.())}</Key></div>
    </>
  );
}
