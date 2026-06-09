import { useState } from 'react';
import { clsx, rozieAttr } from '@rozie/runtime-react';

interface AttrNullishDropProps {}

export default function AttrNullishDrop(props: AttrNullishDropProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [cond, setCond] = useState(false);
  const [maybeNull, setMaybeNull] = useState<any>(null);

  return (
    <>
    <div {...attrs} className={clsx("attr-nullish-drop", (attrs.className as string | undefined))} data-rozie-s-f2d28246="">
      <span data-x={rozieAttr(cond ? 'v' : undefined)} aria-expanded={rozieAttr(cond ? 'true' : 'false')} title={rozieAttr(maybeNull)} data-rozie-s-f2d28246="">probe</span>
    </div>
    </>
  );
}
