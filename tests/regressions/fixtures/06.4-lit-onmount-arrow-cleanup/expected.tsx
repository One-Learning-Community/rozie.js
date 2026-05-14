import { useCallback, useEffect, useState } from 'react';
import styles from './OnMountArrowCleanup.module.css';

interface OnMountArrowCleanupProps {}

export default function OnMountArrowCleanup(props: OnMountArrowCleanupProps): JSX.Element {
  const [ticks, setTicks] = useState(0);
  const [running, setRunning] = useState(true);

  const onResize = useCallback(() => {
    setTicks(prev => prev + 1);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize, window]);

  return (
    <>
    <div className={styles.ticker}>{ticks}</div>
    </>
  );
}
