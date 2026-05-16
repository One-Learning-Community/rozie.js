import type { JSX } from 'solid-js';
import { createMemo, createSignal, mergeProps, splitProps } from 'solid-js';
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
  const _merged = mergeProps({ step: 1, min: -Infinity, max: Infinity }, _props);
  const [local, rest] = splitProps(_merged, ['value', 'step', 'min', 'max']);

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
    <style>{`.counter[data-rozie-s-c72e01d0] { display: inline-flex; gap: 0.5rem; align-items: center; }
    .counter.hovering[data-rozie-s-c72e01d0] { background: rgba(0, 0, 0, 0.04); }
    .value[data-rozie-s-c72e01d0] { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
    button[data-rozie-s-c72e01d0] { padding: 0.25rem 0.5rem; }
    button[data-rozie-s-c72e01d0]:disabled { opacity: 0.4; cursor: not-allowed; }`}</style>
    <>
    <div class={"counter"} classList={{ hovering: hovering() }} onMouseEnter={(e) => { setHovering(true); }} onMouseLeave={(e) => { setHovering(false); }} data-rozie-s-c72e01d0="">
      <button aria-label="Decrement" disabled={!canDecrement()} onClick={decrement} data-rozie-s-c72e01d0="">−</button>
      <span class={"value"} data-rozie-s-c72e01d0="">{value()}</span>
      <button aria-label="Increment" disabled={!canIncrement()} onClick={increment} data-rozie-s-c72e01d0="">+</button>
    </div>
    </>
    </>
  );
}
