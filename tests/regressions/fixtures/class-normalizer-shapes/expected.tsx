import { useState } from 'react';
import { clsx } from '@rozie/runtime-react';

interface ClassNormShapesProps {
  variant?: string;
  arr?: any[];
  flags?: Record<string, any>;
}

export default function ClassNormShapes(_props: ClassNormShapesProps): JSX.Element {
  const __defaultArr = useState(() => (() => [])())[0];
  const __defaultFlags = useState(() => (() => ({}))())[0];
  const props: Omit<ClassNormShapesProps, 'variant' | 'arr' | 'flags'> & { variant: string; arr: any[]; flags: Record<string, any> } = {
    ..._props,
    variant: _props.variant ?? 'primary',
    arr: _props.arr ?? __defaultArr,
    flags: _props.flags ?? __defaultFlags,
  };
  const attrs: Record<string, unknown> = (() => {
    const { variant, arr, flags, ...rest } = _props as ClassNormShapesProps & Record<string, unknown>;
    void variant; void arr; void flags;
    return rest;
  })();
  const [cond, setCond] = useState(true);

  return (
    <>
      <div {...attrs} data-rozie-s-8915b51f="">
        <span className={clsx("static-a", "static-b", 'lit-a lit-b')} data-rozie-s-8915b51f="">string literal</span>
        <span className={props.variant} data-rozie-s-8915b51f="">string-typed prop</span>
        <span className={clsx(['arr-a', props.variant])} data-rozie-s-8915b51f="">array literal</span>
        <span className={clsx({ active: cond })} data-rozie-s-8915b51f="">object literal</span>
        <span className={clsx(props.arr)} data-rozie-s-8915b51f="">array via prop</span>
        <span className={clsx(props.flags)} data-rozie-s-8915b51f="">object via prop</span>
        <span className={clsx("base", props.arr)} data-rozie-s-8915b51f="">static + dynamic merge</span>
      </div>
    </>
  );
}
