import { useState } from 'react';
import { clsx, useDebouncedCallback } from '@rozie/runtime-react';

interface FunctionPropDefaultValueProps {
  onPick?: (...args: any[]) => any;
}

export default function FunctionPropDefaultValue(_props: FunctionPropDefaultValueProps): JSX.Element {
  const props: Omit<FunctionPropDefaultValueProps, 'onPick'> & { onPick: (...args: any[]) => any } = {
    ..._props,
    onPick: _props.onPick ?? (() => {}),
  };
  const attrs: Record<string, unknown> = (() => {
    const { onPick, ...rest } = _props as FunctionPropDefaultValueProps & Record<string, unknown>;
    void onPick;
    return rest;
  })();
  const [n, setN] = useState(0);

  function bump(): void {
    setN(prev => prev + 1);
  }

  const _rozieDebouncedHandler0 = useDebouncedCallback(props.onPick, [props.onPick], 300);

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-8a79dce7=""><input onInput={_rozieDebouncedHandler0} data-rozie-s-8a79dce7="" /></div>
    </>
  );
}
