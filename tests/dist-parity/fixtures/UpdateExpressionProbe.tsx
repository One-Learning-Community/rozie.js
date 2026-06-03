import { useCallback, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './UpdateExpressionProbe.css';

interface UpdateExpressionProbeProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
}

export default function UpdateExpressionProbe(props: UpdateExpressionProbeProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { value, defaultValue, onValueChange, ...rest } = props as UpdateExpressionProbeProps & Record<string, unknown>;
    void value; void defaultValue; void onValueChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? 0,
    onValueChange: props.onValueChange,
  });
  const [count, setCount] = useState(0);

  const incCount = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);
  const decCount = useCallback(() => {
    setCount(prev => prev - 1);
  }, []);
  const incValue = useCallback(() => {
    setValue(prev => prev + 1);
  }, [setValue]);
  const decValue = useCallback(() => {
    setValue(prev => prev - 1);
  }, [setValue]);

  return (
    <>
    <div {...attrs} className={clsx("probe", (attrs.className as string | undefined))} data-rozie-s-0fceff7a="">
      <button aria-label="Decrement count" onClick={decCount} data-rozie-s-0fceff7a="">−</button>
      <span className={"count"} data-rozie-s-0fceff7a="">{count}</span>
      <button aria-label="Increment count" onClick={incCount} data-rozie-s-0fceff7a="">+</button>
      <button aria-label="Decrement value" onClick={decValue} data-rozie-s-0fceff7a="">−</button>
      <span className={"value"} data-rozie-s-0fceff7a="">{value}</span>
      <button aria-label="Increment value" onClick={incValue} data-rozie-s-0fceff7a="">+</button>
    </div>
    </>
  );
}
