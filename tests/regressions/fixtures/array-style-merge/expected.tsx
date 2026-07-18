import { useState } from 'react';
import { parseInlineStyle } from '@rozie/runtime-react';

interface ArrayStyleMergeProps {
  base?: Record<string, any>;
  s?: string;
}

export default function ArrayStyleMerge(_props: ArrayStyleMergeProps): JSX.Element {
  const __defaultBase = useState(() => (() => ({}))())[0];
  const props: Omit<ArrayStyleMergeProps, 'base' | 's'> & { base: Record<string, any>; s: string } = {
    ..._props,
    base: _props.base ?? __defaultBase,
    s: _props.s ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { base, s, ...rest } = _props as ArrayStyleMergeProps & Record<string, unknown>;
    void base; void s;
    return rest;
  })();

  return (
    <>
      <div {...attrs} data-rozie-s-c967fd9e="">
        <span style={parseInlineStyle([{ color: 'red' }, { color: 'blue' }])} data-rozie-s-c967fd9e="">object+object override (later wins → blue)</span>
        <span style={parseInlineStyle([props.s, { fontSize: '12px' }])} data-rozie-s-c967fd9e="">string+object</span>
        <span style={parseInlineStyle([props.base, props.s])} data-rozie-s-c967fd9e="">dynamic+dynamic</span>
      </div>
    </>
  );
}
