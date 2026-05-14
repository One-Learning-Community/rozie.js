import type { ReactNode } from 'react';

interface ItemCtx { value: any; }

interface ScopedParamsFixtureProps {
  label?: string;
  renderItem?: (ctx: ItemCtx) => ReactNode;
}

export default function ScopedParamsFixture(_props: ScopedParamsFixtureProps): JSX.Element {
  const props: ScopedParamsFixtureProps = {
    ..._props,
    label: _props.label ?? 'item',
  };

  return (
    <>
    <div className={"scoped-params-fixture"}>
      {props.renderItem?.({ value: props.label })}
    </div>
    </>
  );
}
