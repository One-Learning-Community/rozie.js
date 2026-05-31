import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';

__rozieInjectStyle('UpdateExpressionProbe-0fceff7a', `.probe[data-rozie-s-0fceff7a] { display: inline-flex; gap: 0.5rem; align-items: center; }
.count[data-rozie-s-0fceff7a], .value[data-rozie-s-0fceff7a] { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
button[data-rozie-s-0fceff7a] { padding: 0.25rem 0.5rem; }`);

interface UpdateExpressionProbeProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
}

export default function UpdateExpressionProbe(_props: UpdateExpressionProbeProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'value', 0);
  const [count, setCount] = createSignal(0);

  function incCount() {
    setCount(count() + 1);
  }
  function decCount() {
    setCount(count() - 1);
  }
  function incValue() {
    setValue(value() + 1);
  }
  function decValue() {
    setValue(value() - 1);
  }

  return (
    <>
    <div {...attrs} class={"probe" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-0fceff7a="">
      <button aria-label="Decrement count" onClick={decCount} data-rozie-s-0fceff7a="">−</button>
      <span class={"count"} data-rozie-s-0fceff7a="">{count()}</span>
      <button aria-label="Increment count" onClick={incCount} data-rozie-s-0fceff7a="">+</button>
      <button aria-label="Decrement value" onClick={decValue} data-rozie-s-0fceff7a="">−</button>
      <span class={"value"} data-rozie-s-0fceff7a="">{value()}</span>
      <button aria-label="Increment value" onClick={incValue} data-rozie-s-0fceff7a="">+</button>
    </div>
    </>
  );
}
