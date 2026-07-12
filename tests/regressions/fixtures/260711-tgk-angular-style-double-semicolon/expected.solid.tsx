import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { parseInlineStyle } from '@rozie/runtime-solid';

interface StyleDoubleSemicolonProps {
  colId?: string;
}

export default function StyleDoubleSemicolon(_props: StyleDoubleSemicolonProps): JSX.Element {
  const _merged = mergeProps({ colId: 'a' }, _props);
  const [local, attrs] = splitProps(_merged, ['colId']);

  const [pad, setPad] = createSignal('padding-left:8px');

  function pinStyle(id: any) {
    return `z-index:1;`;
  }

  return (
    <>
    <div {...attrs} data-rozie-s-6db87b32="">
      
      <span style={parseInlineStyle(pinStyle(local.colId) + ';' + pad())} data-rozie-s-6db87b32="">bug element</span>

      
      <span style={{ color: "red" }} style={{ "font-weight": "bold" }} data-rozie-s-6db87b32="">merge-guard element</span>
    </div>
    </>
  );
}
