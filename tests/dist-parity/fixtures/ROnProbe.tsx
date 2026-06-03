import { useState } from 'react';
import { normalizeListeners, useDebouncedCallback } from '@rozie/runtime-react';
import './ROnProbe.css';

interface ROnProbeProps {}

export default function ROnProbe(props: ROnProbeProps): JSX.Element {
  const [fn, setFn] = useState(() => {});
  const [onInput, setOnInput] = useState(() => {});
  const [f1, setF1] = useState(() => {});
  const [f2, setF2] = useState(() => {});
  const [someObj, setSomeObj] = useState({
    click: () => {},
    mouseenter: () => {}
  });

  const _rozieDebouncedOnInput = useDebouncedCallback(onInput, [fn, onInput], 300);

  return (
    <>
    <div className={"r-on-probe"} data-rozie-s-c4bd99aa="">
      <span onClick={($event) => { $event.stopPropagation(); ((fn) as ((...args: any[]) => any))($event); }} onInput={_rozieDebouncedOnInput} data-rozie-s-c4bd99aa="">literal modifier-bearing</span>
      <span {...normalizeListeners(someObj)} data-rozie-s-c4bd99aa="">dynamic</span>
      <span onClick={($event) => { f1($event); f2($event); }} data-rozie-s-c4bd99aa="">R6 source-order merge</span>
    </div>
    </>
  );
}
