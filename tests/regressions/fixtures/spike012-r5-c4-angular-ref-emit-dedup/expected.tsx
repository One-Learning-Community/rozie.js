import { useEffect, useRef, useState } from 'react';
import { clsx } from '@rozie/runtime-react';

interface RefEmitDedupProps {
  onSave?: (...args: any[]) => void;
}

export default function RefEmitDedup(props: RefEmitDedupProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [n, setN] = useState(0);
  const save = useRef<HTMLDivElement | null>(null);

  function go(): void {
    props.onSave && props.onSave(n);
  }

  useEffect(() => {
    void (save.current as HTMLElement);
  }, []);

  return (
    <>
    <div {...attrs} className={clsx("red", (attrs.className as string | undefined))} data-rozie-s-ab8a0b4b="">
      <div ref={save} data-rozie-s-ab8a0b4b="">x</div>
      <button onClick={($event) => { go(); }} data-rozie-s-ab8a0b4b="">go</button>
    </div>
    </>
  );
}
