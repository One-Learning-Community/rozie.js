import type { JSX } from 'solid-js';
import { createMemo, createSignal, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';

interface CounterProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export default function Counter(_props: CounterProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['value', 'step', 'min', 'max']);

  const [value, setValue] = createControllableSignal(_props as Record<string, unknown>, 'value', 0);
  const [hovering, setHovering] = createSignal(false);
  const canIncrement = createMemo(() => value() + local.step <= local.max);
  const canDecrement = createMemo(() => value() - local.step >= local.min);

  console.log("hello from rozie");
  const increment = () => {
    if (canIncrement()) setValue(value() + local.step);
  };
  const decrement = () => {
    if (canDecrement()) setValue(value() - local.step);
  };

  return (
    <>
    <style>{`.counter { display: inline-flex; gap: 0.5rem; align-items: center; }
    .counter.hovering { background: rgba(0, 0, 0, 0.04); }
    .value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
    button { padding: 0.25rem 0.5rem; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }`}</style>
    <>
    <div class={"counter"} classList={{ hovering: hovering() }} onMouseEnter={(e) => { setHovering(true); }} onMouseLeave={(e) => { setHovering(false); }}>
      <button aria-label="Decrement" disabled={!canDecrement()} onClick={decrement}>−</button>
      <span class={"value"}>{value()}</span>
      <button aria-label="Increment" disabled={!canIncrement()} onClick={increment}>+</button>
    </div>
    </>
    </>
  );
}
