import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { parseInlineStyle } from '@rozie/runtime-solid';

interface ArrayStyleMergeProps {
  base?: Record<string, any>;
  s?: string;
}

export default function ArrayStyleMerge(_props: ArrayStyleMergeProps): JSX.Element {
  const _merged = mergeProps({ base: (() => ({}))() as Record<string, any>, s: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['base', 's']);

  return (
    <>
      <div {...attrs} data-rozie-s-c967fd9e="">
        <span style={parseInlineStyle([{ color: 'red' }, { color: 'blue' }])} data-rozie-s-c967fd9e="">object+object override (later wins → blue)</span>
        <span style={parseInlineStyle([local.s, { fontSize: '12px' }])} data-rozie-s-c967fd9e="">string+object</span>
        <span style={parseInlineStyle([local.base, local.s])} data-rozie-s-c967fd9e="">dynamic+dynamic</span>
      </div>
    </>
  );
}
