import type { JSX } from 'solid-js';
import { children, mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';

interface LoopMustacheKeyedSlotRforProps {
  rows?: any[];
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function LoopMustacheKeyedSlotRfor(_props: LoopMustacheKeyedSlotRforProps): JSX.Element {
  const _merged = mergeProps({ rows: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['rows', 'children']);
  const resolved = children(() => local.children);

  function noop(): void {}

  return (
    <>

    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-10bfe9b6=""><Key each={local.rows as readonly any[]} by={(row) => row.id}>{(row) => (typeof local.children === 'function' ? (local.children as (s: any) => any)({ name: row() }) : resolved())}</Key></div>
    </>
  );
}
