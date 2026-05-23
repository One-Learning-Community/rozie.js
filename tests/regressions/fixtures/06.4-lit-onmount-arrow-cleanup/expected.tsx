import { useCallback, useEffect, useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './OnMountArrowCleanup.module.css';

interface OnMountArrowCleanupProps {}

export default function OnMountArrowCleanup(props: OnMountArrowCleanupProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(true);

  const onResize = useCallback(() => {
    setTicks(prev => prev + 1);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx(styles.ticker, (attrs.className as string | undefined))} {...attrs} data-rozie-s-722b58d1="">{ticks}</div>
    </>
  );
}
