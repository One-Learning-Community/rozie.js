import type { JSX } from 'solid-js';
import { createSignal, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('ExposeProbe-dd2b93b0', `.expose-probe[data-rozie-s-dd2b93b0] { display: inline-flex; align-items: center; gap: 0.5rem; }
input[data-rozie-s-dd2b93b0] { padding: 0.25rem 0.5rem; }
.echo[data-rozie-s-dd2b93b0] { font-variant-numeric: tabular-nums; color: rgba(0, 0, 0, 0.6); }`);

interface ExposeProbeProps {
  ref?: (h: ExposeProbeHandle) => void;
}

export interface ExposeProbeHandle {
  reset(): void;
  focus(): void;
}

export default function ExposeProbe(_props: ExposeProbeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['ref']);
  onMount(() => { local.ref?.({ reset, focus }); });

  const [value, setValue] = createSignal('');
  let fieldRef: HTMLElement | null = null;

  function reset(): void {
    setValue('');
  }
  function focus(): void {
    fieldRef.focus();
  }

  return (
    <>
    <div {...attrs} class={"expose-probe" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-dd2b93b0="">
      <input ref={(el) => { fieldRef = el as HTMLElement; }} type="text" placeholder="Type something" value={value()} onInput={e => setValue(e.currentTarget.value)} data-rozie-s-dd2b93b0="" />
      <span class={"echo"} data-rozie-s-dd2b93b0="">{value()}</span>
    </div>
    </>
  );
}
