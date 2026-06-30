import type { JSX } from 'solid-js';
import { createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('PropDefaultCoercion-109e595c', `.pdc[data-rozie-s-109e595c] {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem;
  font-family: ui-monospace, monospace;
}
.pdc[data-rozie-s-109e595c] pre[data-rozie-s-109e595c] {
  margin: 0;
}`);

interface PropDefaultCoercionProps {
  a?: (Record<string, any>) | null;
  b?: number;
  c?: string;
  d?: boolean;
  e?: any[];
  f?: Record<string, any>;
}

export default function PropDefaultCoercion(_props: PropDefaultCoercionProps): JSX.Element {
  const _merged = mergeProps({ a: null, b: 0, c: '', d: false, e: (() => [])(), f: (() => ({
  k: 1
}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['a', 'b', 'c', 'd', 'e', 'f']);

  const [observed, setObserved] = createSignal<any>(null);
  onMount(() => {
    setObserved({
      a: local.a,
      b: local.b,
      c: local.c,
      d: local.d,
      e: local.e,
      f: local.f
    });
  });

  return (
    <>
    <div {...attrs} class={"pdc" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-109e595c="">
      <pre data-rozie-pdc-output="" data-rozie-s-109e595c="">{rozieDisplay(JSON.stringify(observed()))}</pre>
      
      <span data-rozie-pdc-e-identity="" data-rozie-s-109e595c="">{rozieDisplay(local.e === local.e ? 'true' : 'false')}</span>
      <span data-rozie-pdc-f-identity="" data-rozie-s-109e595c="">{rozieDisplay(local.f === local.f ? 'true' : 'false')}</span>
    </div>
    </>
  );
}
