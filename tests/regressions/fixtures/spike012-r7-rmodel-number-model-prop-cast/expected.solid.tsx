import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';

interface RModelNumberModelPropProps {
  quantity?: number;
  defaultQuantity?: number;
  onQuantityChange?: (quantity: number) => void;
}

export default function RModelNumberModelProp(_props: RModelNumberModelPropProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['quantity']);

  const [quantity, setQuantity] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'quantity', 0);

  return (
    <>
    <div {...attrs} class={"rmodel-number-model-prop" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-ce78b2e7="">
      <input type="text" value={quantity()} onInput={e => setQuantity((Number.isNaN(Number.parseFloat(e.currentTarget.value)) ? e.currentTarget.value : Number.parseFloat(e.currentTarget.value)) as number)} data-rozie-s-ce78b2e7="" />
    </div>
    </>
  );
}
