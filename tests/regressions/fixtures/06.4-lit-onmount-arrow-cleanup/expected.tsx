import { useCallback, useEffect, useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import './OnMountArrowCleanup.css';

interface OnMountArrowCleanupProps {}

export default function OnMountArrowCleanup(props: OnMountArrowCleanupProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(true);

  // CR-04 reproduction: a concise-arrow $onMount whose body returns a teardown
  // function must register that teardown as a cleanup, NOT silently drop it.
  // Before the fix the Lit emitter ignored the returned function, leaking the
  // resize subscription across disconnect. The teardown here is self-contained
  // (no reference to a hoisted setup local) so the fixture isolates exactly the
  // "is the returned cleanup registered?" contract.
  const onResize = useCallback(() => {
    setTicks(prev => prev + 1);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("ticker", (attrs.className as string | undefined))} data-rozie-s-722b58d1="">{ticks}</div>
    </>
  );
}
