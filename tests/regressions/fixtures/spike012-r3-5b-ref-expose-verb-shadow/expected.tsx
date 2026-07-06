import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx } from '@rozie/runtime-react';

interface RefExposeVerbShadowProps {}

export interface RefExposeVerbShadowHandle {
  box(): void;
}

const RefExposeVerbShadow = forwardRef<RefExposeVerbShadowHandle, RefExposeVerbShadowProps>(function RefExposeVerbShadow(props: RefExposeVerbShadowProps, ref): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [n, setN] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  function box(): void {
    setN(prev => prev + 1);
  }

  useEffect(() => {
    void (boxRef.current as HTMLElement);
  }, []);

  const _rozieExposeRef = useRef({ box });
  _rozieExposeRef.current = { box };
  useImperativeHandle(ref, () => ({ box: (...args: Parameters<typeof box>): ReturnType<typeof box> => _rozieExposeRef.current.box(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-d26c63bb=""><div ref={boxRef} data-rozie-s-d26c63bb="">x</div></div>
    </>
  );
});
export default RefExposeVerbShadow;
