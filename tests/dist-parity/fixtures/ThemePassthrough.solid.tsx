import type { JSX } from 'solid-js';
import { children, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('ThemePassthrough-515c25a2', `.theme-passthrough[data-rozie-s-515c25a2] {
  display: block;
  padding: 0.5rem;
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}`);

interface ThemePassthroughProps {
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function ThemePassthrough(_props: ThemePassthroughProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['children']);
  const resolved = children(() => local.children);

  return (
    <>
    <div data-theme-passthrough="" {...attrs} class={"theme-passthrough" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-515c25a2="">
      {resolved()}
    </div>
    </>
  );
}
