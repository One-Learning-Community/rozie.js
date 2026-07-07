import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from '@rozie/runtime-react';

interface RefSuffixCollisionProps {}

export default function RefSuffixCollision(props: RefSuffixCollisionProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [n, setN] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);

  const boxRef = useMemo(() => 7, []);

  useEffect(() => {
    setN((box.current as HTMLElement).childElementCount + boxRef);
  }, []);

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-3039287c=""><div ref={box} data-rozie-s-3039287c="">x</div></div>
    </>
  );
}
