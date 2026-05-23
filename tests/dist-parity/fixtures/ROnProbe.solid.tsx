import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { createDebouncedHandler, normalizeListeners } from '@rozie/runtime-solid';

interface ROnProbeProps {}

export default function ROnProbe(_props: ROnProbeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [fn, setFn] = createSignal(() => {});
  const [onInput, setOnInput] = createSignal(() => {});
  const [f1, setF1] = createSignal(() => {});
  const [f2, setF2] = createSignal(() => {});
  const [someObj, setSomeObj] = createSignal({
    click: () => {},
    mouseenter: () => {}
  });

  const _rozieDebouncedOnInput = createDebouncedHandler(onInput, 300);

  return (
    <>
    <style>{`.r-on-probe[data-rozie-s-c4bd99aa] {
      display: inline-flex;
      gap: 0.5rem;
      padding: 0.25rem;
    }
    .r-on-probe[data-rozie-s-c4bd99aa] span[data-rozie-s-c4bd99aa] {
      display: inline-block;
      padding: 0.125rem 0.25rem;
    }`}</style>
    <>
    <div class={"r-on-probe"} data-rozie-s-c4bd99aa="">
      <span onClick={($event) => { $event.stopPropagation(); fn(); }} onInput={_rozieDebouncedOnInput} data-rozie-s-c4bd99aa="">literal modifier-bearing</span>
      <span {...normalizeListeners(someObj)} data-rozie-s-c4bd99aa="">dynamic</span>
      <span onClick={($event) => { f1($event); f2($event); }} data-rozie-s-c4bd99aa="">R6 source-order merge</span>
    </div>
    </>
    </>
  );
}
