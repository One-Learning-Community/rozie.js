import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import DummyEngine from 'dummy-engine';

interface SpikeImportElProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SpikeImportEl(props: SpikeImportElProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const instance = useRef<any>(null);
  const __rozieRoot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    instance.current = new DummyEngine(__rozieRoot.current!, {
      animation: 150
    });
    return () => instance.current?.destroy();
  }, []);

  return (
    <>
    <div ref={__rozieRoot} {...attrs} className={clsx("spike-root", (attrs.className as string | undefined))} data-rozie-s-f590f443="">
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
  );
}
