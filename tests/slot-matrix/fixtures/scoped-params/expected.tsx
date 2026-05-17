import type { ReactNode } from 'react';

interface ItemCtx { value: any; }

interface ScopedParamsFixtureProps {
  label?: string;
  renderItem?: (ctx: ItemCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function ScopedParamsFixture(_props: ScopedParamsFixtureProps): JSX.Element {
  const props: ScopedParamsFixtureProps = {
    ..._props,
    label: _props.label ?? 'item',
  };

  return (
    <>
    <div className={"scoped-params-fixture"} data-rozie-s-94f3adc8="">
      {(props.renderItem ?? props.slots?.['item'])?.({ value: props.label })}
    </div>
    </>
  );
}
