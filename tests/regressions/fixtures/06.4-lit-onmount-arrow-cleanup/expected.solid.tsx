import type { JSX } from 'solid-js';
import { createSignal, onCleanup, onMount, splitProps } from 'solid-js';

interface OnMountArrowCleanupProps {}

export default function OnMountArrowCleanup(_props: OnMountArrowCleanupProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  const [ticks, setTicks] = createSignal(0);
  const [running, setRunning] = createSignal(true);
  onMount(() => {
    const _cleanup = (() => {
    window.addEventListener('resize', onResize);
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => window.removeEventListener('resize', onResize));
  });

  // CR-04 reproduction: a concise-arrow $onMount whose body returns a teardown
  // function must register that teardown as a cleanup, NOT silently drop it.
  // Before the fix the Lit emitter ignored the returned function, leaking the
  // resize subscription across disconnect. The teardown here is self-contained
  // (no reference to a hoisted setup local) so the fixture isolates exactly the
  // "is the returned cleanup registered?" contract.
  const onResize = () => {
    setTicks(ticks() + 1);
  };

  return (
    <>
    <style>{`.ticker[data-rozie-s-722b58d1] { font-variant-numeric: tabular-nums; }`}</style>
    <>
    <div class={"ticker"} data-rozie-s-722b58d1="">{ticks()}</div>
    </>
    </>
  );
}
