import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('RBindProbe-8e2458d6', `.rbind-probe[data-rozie-s-8e2458d6] {
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.25rem;
}
.a[data-rozie-s-8e2458d6] { color: #1f2937; }
.b[data-rozie-s-8e2458d6] { font-weight: 700; }`);

interface RBindProbeProps {}

export default function RBindProbe(_props: RBindProbeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <div class={"rbind-probe"} {...attrs} data-rozie-s-8e2458d6="">
      <span class={('a') + " " + ('b')} {...{ id: 'x' }} data-rozie-s-8e2458d6="">canonical</span>
      <span {...{ id: 'y' }} class={('b') + " " + ('a')} data-rozie-s-8e2458d6="">reordered</span>
    </div>
    </>
  );
}
