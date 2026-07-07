import { useState } from 'react';
import { clsx } from '@rozie/runtime-react';

interface FnPropNullGateProps {
  onSave?: (...args: any[]) => any;
  onCancel?: ((...args: any[]) => any) | null;
}

export default function FnPropNullGate(_props: FnPropNullGateProps): JSX.Element {
  const props: Omit<FnPropNullGateProps, 'onSave' | 'onCancel'> & { onSave: (...args: any[]) => any; onCancel: ((...args: any[]) => any) | null } = {
    ..._props,
    onSave: _props.onSave ?? (() => {}),
    onCancel: _props.onCancel ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { onSave, onCancel, ...rest } = _props as FnPropNullGateProps & Record<string, unknown>;
    void onSave; void onCancel;
    return rest;
  })();
  const [n, setN] = useState(0);

  return (
    <>
    <div {...attrs} className={clsx("fpg", (attrs.className as string | undefined))} data-rozie-s-a5944868="">
      <button className={"save"} onClick={($event) => { ((props.onSave) as ((...args: any[]) => any) | undefined)?.($event); }} data-rozie-s-a5944868="">save</button>
      <button className={"cancel"} onClick={($event) => { props.onCancel && props.onCancel(); }} data-rozie-s-a5944868="">cancel</button>
      <span className={"n"} data-rozie-s-a5944868="">{n}</span>
    </div>
    </>
  );
}
