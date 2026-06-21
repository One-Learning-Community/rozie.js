import { useState } from 'react';
import { parseInlineStyle } from '@rozie/runtime-react';

interface StyleNormShapesProps {
  s?: string;
  obj?: Record<string, any>;
}

export default function StyleNormShapes(_props: StyleNormShapesProps): JSX.Element {
  const __defaultObj = useState(() => (() => ({}))())[0];
  const props: Omit<StyleNormShapesProps, 's' | 'obj'> & { s: string; obj: Record<string, any> } = {
    ..._props,
    s: _props.s ?? '',
    obj: _props.obj ?? __defaultObj,
  };
  const attrs: Record<string, unknown> = (() => {
    const { s, obj, ...rest } = _props as StyleNormShapesProps & Record<string, unknown>;
    void s; void obj;
    return rest;
  })();

  return (
    <>
      <div {...attrs} data-rozie-s-6d99ef35="">
        <span style={{ color: 'red' }} data-rozie-s-6d99ef35="">object literal</span>
        <span style={parseInlineStyle(props.s)} data-rozie-s-6d99ef35="">string via prop</span>
        <span style={parseInlineStyle(props.obj)} data-rozie-s-6d99ef35="">object via prop</span>
      </div>
    </>
  );
}
