import { useEffect, useRef, useState } from 'react';
import { clsx } from '@rozie/runtime-react';

interface RefShadowsDataKeyProps {}

export default function RefShadowsDataKey(props: RefShadowsDataKeyProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [box, setBox] = useState(0);
  const [n, setN] = useState(0);
  const _boxRef = useRef(box);
  _boxRef.current = box;
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setN((boxRef.current as HTMLElement).childElementCount + _boxRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-89956078="">
      <div ref={boxRef} data-rozie-s-89956078="">x</div>
    </div>
    </>
  );
}
