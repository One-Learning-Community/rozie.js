import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';

interface ItemSlotCtx { value: any; }

interface ScopedParamsFixtureProps {
  label?: string;
  itemSlot?: (ctx: ItemSlotCtx) => JSX.Element;
}

export default function ScopedParamsFixture(_props: ScopedParamsFixtureProps): JSX.Element {
  const _merged = mergeProps({ label: 'item' }, _props);
  const [local, rest] = splitProps(_merged, ['label']);

  return (
    <>
    <div class={"scoped-params-fixture"} data-rozie-s-94f3adc8="">
      {_props.itemSlot?.({ value: local.label })}
    </div>
    </>
  );
}
