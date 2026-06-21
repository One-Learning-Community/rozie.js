import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { parseInlineStyle } from '@rozie/runtime-solid';

interface StyleNormShapesProps {
  s?: string;
  obj?: Record<string, any>;
}

export default function StyleNormShapes(_props: StyleNormShapesProps): JSX.Element {
  const _merged = mergeProps({ s: '', obj: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['s', 'obj']);

  return (
    <>
      <div {...attrs} data-rozie-s-6d99ef35="">
        <span style={{ color: 'red' }} data-rozie-s-6d99ef35="">object literal</span>
        <span style={parseInlineStyle(local.s)} data-rozie-s-6d99ef35="">string via prop</span>
        <span style={parseInlineStyle(local.obj)} data-rozie-s-6d99ef35="">object via prop</span>
      </div>
    </>
  );
}
