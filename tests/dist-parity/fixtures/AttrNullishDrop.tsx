import { useState } from 'react';
import { clsx, rozieAttr, rozieDisplay } from '@rozie/runtime-react';

interface AttrNullishDropProps {
  maybeNullProp?: (string) | null;
}

export default function AttrNullishDrop(_props: AttrNullishDropProps): JSX.Element {
  const props: Omit<AttrNullishDropProps, 'maybeNullProp'> & { maybeNullProp: (string) | null } = {
    ..._props,
    maybeNullProp: _props.maybeNullProp ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { maybeNullProp, ...rest } = _props as AttrNullishDropProps & Record<string, unknown>;
    void maybeNullProp;
    return rest;
  })();
  const [cond, setCond] = useState(false);
  const [maybeNull, setMaybeNull] = useState<any>(null);
  const [loopItems, setLoopItems] = useState(['a', 'b']);

  return (
    <>
    <div {...attrs} className={clsx("attr-nullish-drop", (attrs.className as string | undefined))} data-rozie-s-f2d28246="">
      <span data-x={rozieAttr(cond ? 'v' : undefined)} aria-expanded={rozieAttr(cond ? 'true' : 'false')} title={rozieAttr(maybeNull)} data-rozie-s-f2d28246="">probe</span>
      <span className={"attr-nullish-drop-prop"} title={rozieAttr(props.maybeNullProp)} data-rozie-s-f2d28246="">probe-prop</span>
      {loopItems.map((c) => <i key={c} className={"attr-nullish-drop-loop"} title={rozieAttr(props.maybeNullProp)} data-rozie-s-f2d28246="">{rozieDisplay(c)}</i>)}
    </div>
    </>
  );
}
