import { useEffect, useRef, useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import './CloneProbe.css';

interface CloneProbeProps {}

export default function CloneProbe(props: CloneProbeProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [state, setState] = useState({
    count: 0,
    created: new Date(0)
  });
  const [cloned, setCloned] = useState<any>(null);
  const _stateRef = useRef(state);
  _stateRef.current = state;

  useEffect(() => {
    setCloned(structuredClone(_stateRef.current));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("probe", (attrs.className as string | undefined))} data-rozie-s-67c332fe="">
      <span className={"count"} data-rozie-s-67c332fe="">count: {rozieDisplay(state.count)}</span>
      {(cloned) && <span className={"cloned"} data-rozie-s-67c332fe="">cloned</span>}</div>
    </>
  );
}
