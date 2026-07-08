import { clsx, useControllableState } from '@rozie/runtime-react';

interface RModelNumberModelPropProps {
  quantity?: number;
  defaultQuantity?: number;
  onQuantityChange?: (quantity: number) => void;
}

export default function RModelNumberModelProp(props: RModelNumberModelPropProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { quantity, defaultValue, onQuantityChange, defaultQuantity, ...rest } = props as RModelNumberModelPropProps & Record<string, unknown>;
    void quantity; void defaultValue; void onQuantityChange; void defaultQuantity;
    return rest;
  })();
  const [quantity, setQuantity] = useControllableState({
    value: props.quantity,
    defaultValue: props.defaultQuantity ?? 0,
    onValueChange: props.onQuantityChange,
  });

  return (
    <>
    <div {...attrs} className={clsx("rmodel-number-model-prop", (attrs.className as string | undefined))} data-rozie-s-ce78b2e7="">
      <input type="text" value={quantity} onChange={e => setQuantity((Number.isNaN(Number.parseFloat(e.target.value)) ? e.target.value : Number.parseFloat(e.target.value)) as number)} data-rozie-s-ce78b2e7="" />
    </div>
    </>
  );
}
