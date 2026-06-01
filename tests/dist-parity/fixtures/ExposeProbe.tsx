import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './ExposeProbe.module.css';

interface ExposeProbeProps {}

interface ExposeProbeHandle {
  reset(): void;
  focus(): void;
}

const ExposeProbe = forwardRef<ExposeProbeHandle, ExposeProbeProps>(function ExposeProbe(props: ExposeProbeProps, ref): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [value, setValue] = useState('');
  const field = useRef<HTMLInputElement | null>(null);

  function reset(): void {
    setValue('');
  }
  function focus(): void {
    field.current!.focus();
  }

  useImperativeHandle(ref, () => ({ reset, focus }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx(styles["expose-probe"], (attrs.className as string | undefined))} data-rozie-s-dd2b93b0="">
      <input ref={field} type="text" placeholder="Type something" value={value} onChange={e => setValue(e.target.value)} data-rozie-s-dd2b93b0="" />
      <span className={styles.echo} data-rozie-s-dd2b93b0="">{value}</span>
    </div>
    </>
  );
});
export default ExposeProbe;
