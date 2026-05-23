import { clsx } from '@rozie/runtime-react';
import styles from './RBindProbe.module.css';

interface RBindProbeProps {}

export default function RBindProbe(props: RBindProbeProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div className={styles["rbind-probe"]} {...attrs} data-rozie-s-8e2458d6="">
      <span className={clsx('a', 'b')} {...{ id: 'x' }} data-rozie-s-8e2458d6="">canonical</span>
      <span {...{ id: 'y' }} className={clsx('b', 'a')} data-rozie-s-8e2458d6="">reordered</span>
    </div>
    </>
  );
}
