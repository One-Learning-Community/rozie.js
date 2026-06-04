import { useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface ObjectInterpProps {}

export default function ObjectInterp(props: ObjectInterpProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [obj, setObj] = useState({
    a: 1,
    b: [2, 3]
  });

  return (
    <>
    <div {...attrs} className={clsx("object-interp", (attrs.className as string | undefined))} data-rozie-s-aca60b6e="">
      <p className={`card--${rozieDisplay(obj)}`} data-x={rozieDisplay(obj)} data-rozie-s-aca60b6e="">{rozieDisplay(obj)}</p>
    </div>
    </>
  );
}
