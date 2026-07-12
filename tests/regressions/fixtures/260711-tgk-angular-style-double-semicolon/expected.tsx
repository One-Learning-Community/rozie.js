import { useState } from 'react';
import { parseInlineStyle } from '@rozie/runtime-react';

interface StyleDoubleSemicolonProps {
  colId?: string;
}

export default function StyleDoubleSemicolon(_props: StyleDoubleSemicolonProps): JSX.Element {
  const props: Omit<StyleDoubleSemicolonProps, 'colId'> & { colId: string } = {
    ..._props,
    colId: _props.colId ?? 'a',
  };
  const attrs: Record<string, unknown> = (() => {
    const { colId, ...rest } = _props as StyleDoubleSemicolonProps & Record<string, unknown>;
    void colId;
    return rest;
  })();
  const [pad, setPad] = useState('padding-left:8px');

  function pinStyle(id: any) {
    return `z-index:1;`;
  }

  return (
    <>
    <div {...attrs} data-rozie-s-6db87b32="">
      
      <span style={parseInlineStyle(pinStyle(props.colId) + ';' + pad)} data-rozie-s-6db87b32="">bug element</span>

      
      <span style={{ color: "red" }} style={{ fontWeight: "bold" }} data-rozie-s-6db87b32="">merge-guard element</span>
    </div>
    </>
  );
}
