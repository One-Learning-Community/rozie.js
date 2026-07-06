import { useEffect, useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import './OnMountMountLocalCleanup.css';

interface OnMountMountLocalCleanupProps {
  label?: string;
}

export default function OnMountMountLocalCleanup(_props: OnMountMountLocalCleanupProps): JSX.Element {
  const props: Omit<OnMountMountLocalCleanupProps, 'label'> & { label: string } = {
    ..._props,
    label: _props.label ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { label, ...rest } = _props as OnMountMountLocalCleanupProps & Record<string, unknown>;
    void label;
    return rest;
  })();
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTicks(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("ticks", (attrs.className as string | undefined))} data-rozie-s-c1a25008="">{ticks}</div>
    </>
  );
}
