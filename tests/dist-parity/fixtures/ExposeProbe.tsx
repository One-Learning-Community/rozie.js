import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import './ExposeProbe.css';

interface ExposeProbeProps {}

export interface ExposeProbeHandle {
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

  const _rozieExposeRef = useRef({ reset, focus });
  _rozieExposeRef.current = { reset, focus };
  useImperativeHandle(ref, () => ({ reset: (...args: Parameters<typeof reset>): ReturnType<typeof reset> => _rozieExposeRef.current.reset(...args), focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx("expose-probe", (attrs.className as string | undefined))} data-rozie-s-dd2b93b0="">
      <input ref={field} type="text" placeholder="Type something" value={value} onChange={e => setValue(e.target.value)} data-rozie-s-dd2b93b0="" />
      <span className={"echo"} data-rozie-s-dd2b93b0="">{value}</span>
    </div>
    </>
  );
});
export default ExposeProbe;
