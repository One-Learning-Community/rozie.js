import type { JSX } from 'solid-js';
import { Show, createSignal, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('CloneProbe-67c332fe', `.probe[data-rozie-s-67c332fe] {
  display: block;
  padding: 0.5rem;
}`);

interface CloneProbeProps {}

export default function CloneProbe(_props: CloneProbeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [state, setState] = createSignal({
    count: 0,
    created: new Date(0)
  });
  const [cloned, setCloned] = createSignal(null);
  onMount(() => {
    setCloned(structuredClone(state()));
  });

  return (
    <>
    <div {...attrs} class={"probe" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-67c332fe="">
      <span class={"count"} data-rozie-s-67c332fe="">count: {rozieDisplay(state().count)}</span>
      {<Show when={cloned()}><span class={"cloned"} data-rozie-s-67c332fe="">cloned</span></Show>}</div>
    </>
  );
}
