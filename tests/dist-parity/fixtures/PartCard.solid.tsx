import type { JSX } from 'solid-js';
import { children, mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('PartCard-1462f7ea', `.card-body[data-rozie-s-1462f7ea] {
  padding: 1rem;
  border-radius: 0.5rem;
  background: #f3f4f6;
}
.card-title[data-rozie-s-1462f7ea] {
  margin: 0 0 0.5rem;
  font: inherit;
  font-weight: 600;
}`);

interface PartCardProps {
  title?: string;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function PartCard(_props: PartCardProps): JSX.Element {
  const _merged = mergeProps({ title: 'Card' }, _props);
  const [local, attrs] = splitProps(_merged, ['title', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    <div part="body" {...attrs} class={"card-body" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-1462f7ea="">
      <h3 class={"card-title"} data-rozie-s-1462f7ea="">{local.title}</h3>
      {resolved()}
    </div>
    </>
  );
}
