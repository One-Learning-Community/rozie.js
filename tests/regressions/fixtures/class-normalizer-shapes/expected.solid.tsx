import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { rozieClass } from '@rozie/runtime-solid';

interface ClassNormShapesProps {
  variant?: string;
  arr?: any[];
  flags?: Record<string, any>;
}

export default function ClassNormShapes(_props: ClassNormShapesProps): JSX.Element {
  const _merged = mergeProps({ variant: 'primary', arr: (() => [])() as any[], flags: (() => ({}))() as Record<string, any> }, _props);
  const [local, attrs] = splitProps(_merged, ['variant', 'arr', 'flags']);

  const [cond, setCond] = createSignal(true);

  return (
    <>
      <div {...attrs} data-rozie-s-8915b51f="">
        <span class={"static-a static-b" + " " + ('lit-a lit-b')} data-rozie-s-8915b51f="">string literal</span>
        <span class={local.variant} data-rozie-s-8915b51f="">string-typed prop</span>
        <span class={rozieClass(['arr-a', local.variant])} data-rozie-s-8915b51f="">array literal</span>
        <span class={rozieClass({ active: cond() })} data-rozie-s-8915b51f="">object literal</span>
        <span class={rozieClass(local.arr)} data-rozie-s-8915b51f="">array via prop</span>
        <span class={rozieClass(local.flags)} data-rozie-s-8915b51f="">object via prop</span>
        <span class={"base" + " " + rozieClass(local.arr)} data-rozie-s-8915b51f="">static + dynamic merge</span>
      </div>
    </>
  );
}
