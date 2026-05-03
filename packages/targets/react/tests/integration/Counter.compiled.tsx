// Hand-copied from packages/targets/react/fixtures/Counter.tsx.snap with
// the addition of a `styles` shim. Used by counter-controllable.test.tsx
// to verify the controlled / uncontrolled / parent-flip flows
// (REACT-T-03 / Plan 04-04 success criterion 3).
import { useMemo, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';

const styles: Record<string, string> = new Proxy({}, { get: (_t, k) => String(k) });

interface CounterProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export default function Counter(props: CounterProps): JSX.Element {
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? 0,
    onValueChange: props.onValueChange,
  });
  const [hovering, setHovering] = useState(false);
  const step = props.step ?? 1;
  const max = props.max ?? Number.POSITIVE_INFINITY;
  const min = props.min ?? Number.NEGATIVE_INFINITY;
  const canIncrement = useMemo(() => value + step <= max, [value, step, max]);
  const canDecrement = useMemo(() => value - step >= min, [value, step, min]);

  const increment = () => {
    if (canIncrement) setValue((prev) => prev + step);
  };
  const decrement = () => {
    if (canDecrement) setValue((prev) => prev - step);
  };

  return (
    <div
      className={clsx(styles.counter, { [styles.hovering]: hovering })}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        disabled={!canDecrement}
        aria-label="Decrement"
        onClick={decrement}
      >
        −
      </button>
      <span className={styles.value} data-testid="value">
        {value}
      </span>
      <button
        disabled={!canIncrement}
        aria-label="Increment"
        onClick={increment}
      >
        +
      </button>
    </div>
  );
}
