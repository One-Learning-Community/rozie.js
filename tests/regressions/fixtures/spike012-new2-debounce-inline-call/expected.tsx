import { useState } from 'react';
import { clsx, useDebouncedCallback, useThrottledCallback } from '@rozie/runtime-react';

interface DebounceInlineCallProps {}

export default function DebounceInlineCall(props: DebounceInlineCallProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [n, setN] = useState(0);

  function bump(): void {
    setN(prev => prev + 1);
  }

  const _rozieDebouncedHandler0 = useDebouncedCallback(($event: any) => { bump(); }, [bump], 300);
  const _rozieThrottledHandler1_1 = useThrottledCallback(($event: any) => { bump(); }, [bump], 200);

  return (
    <>
    <div {...attrs} className={clsx("root", (attrs.className as string | undefined))} data-rozie-s-bbb11bc5="">
      <input className={"deb"} onInput={_rozieDebouncedHandler0} data-rozie-s-bbb11bc5="" />
      <button className={"thr"} onClick={_rozieThrottledHandler1_1} data-rozie-s-bbb11bc5="">{n}</button>
    </div>
    </>
  );
}
