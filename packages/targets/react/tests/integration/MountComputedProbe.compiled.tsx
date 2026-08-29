// Quick 260829-8lz — this file is EMITTER OUTPUT, not hand-authored.
//
// Compiled with `emitReact` (parse + lowerToIR + emitReact from `@rozie/core`)
// from the source below, using the CURRENT emitter at the time of this
// commit. Task 2 REGENERATES this file from the FIXED emitter — never
// hand-edit it. If it drifts from what the emitter now produces, recompile
// and replace it wholesale.
//
// Source compiled:
//
//   <rozie name="MountComputedProbe">
//   <data>
//   {
//     tick: 0,
//     observed: 0,
//   }
//   </data>
//   <script>
//   const doubled = $computed(() => $data.tick * 2)
//   let read = null
//   const invokeRead = () => { if (read) read() }
//   $onMount(() => {
//     read = () => { $data.observed = doubled }
//   })
//   </script>
//   <template>
//     <div>
//       <span data-testid="tick">{{ tick }}</span>
//       <span data-testid="doubled">{{ doubled }}</span>
//       <span data-testid="observed">{{ observed }}</span>
//       <button data-testid="bump" @click="$data.tick = $data.tick + 1">bump</button>
//       <button data-testid="invoke" @click="invokeRead()">invoke</button>
//     </div>
//   </template>
//   </rozie>
//
// Demonstrates the mount-frozen-computed defect: `read.current` is assigned
// ONCE inside a `[]`-dep mount effect, and its body reads `doubled` (a plain
// `useMemo` destructured const) BARE. `doubled` recomputes on every `tick`
// change, but the mount closure never sees the recomputation — it captured
// the FIRST render's `doubled` (0) forever. Clicking "bump" moves `doubled`
// to 2 in the DOM (`data-testid="doubled"`), but clicking "invoke" still
// writes the FROZEN value into `observed`. Post-fix, `read.current`'s body
// reads `_doubledRef.current` instead, so "invoke" observes the CURRENT
// value. See `../mount-computed-live.test.tsx`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rozieDisplay } from '@rozie/runtime-react';

interface MountComputedProbeProps {}

export default function MountComputedProbe(props: MountComputedProbeProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const read = useRef<any>(null);
  const [tick, setTick] = useState(0);
  const [observed, setObserved] = useState(0);
  const doubled = useMemo(() => tick * 2, [tick]);

  const invokeRead = useCallback(() => {
    if (read.current) read.current();
  }, []);

  useEffect(() => {
    read.current = () => {
      setObserved(doubled);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div {...attrs} data-rozie-s-994f8e6e="">
        <span data-testid="tick" data-rozie-s-994f8e6e="">{rozieDisplay(tick)}</span>
        <span data-testid="doubled" data-rozie-s-994f8e6e="">{rozieDisplay(doubled)}</span>
        <span data-testid="observed" data-rozie-s-994f8e6e="">{rozieDisplay(observed)}</span>
        <button data-testid="bump" onClick={($event) => { setTick(tick + 1); }} data-rozie-s-994f8e6e="">bump</button>
        <button data-testid="invoke" onClick={($event) => { invokeRead(); }} data-rozie-s-994f8e6e="">invoke</button>
      </div>
    </>
  );
}
