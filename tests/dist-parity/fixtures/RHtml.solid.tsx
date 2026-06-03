import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('RHtml-09a5f2a6', `.rhtml[data-rozie-s-09a5f2a6] { font: 1rem/1.4 system-ui; }`);

interface RHtmlProps {
  content?: string;
}

export default function RHtml(_props: RHtmlProps): JSX.Element {
  const _merged = mergeProps({ content: '<strong>safe</strong>' }, _props);
  const [local, attrs] = splitProps(_merged, ['content']);

  return (
    <>
    <div {...attrs} class={"rhtml" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} innerHTML={local.content} data-rozie-s-09a5f2a6="" />
    </>
  );
}
