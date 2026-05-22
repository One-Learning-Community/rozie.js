import type { ReactNode } from 'react';

interface ItemCtx { value: any; }

interface ScopedParamsFixtureProps {
  label?: string;
  renderItem?: (ctx: ItemCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function ScopedParamsFixture(_props: ScopedParamsFixtureProps): JSX.Element {
  const props: ScopedParamsFixtureProps & { label: string } = {
    ..._props,
    label: _props.label ?? 'item',
  };
  const attrs: Record<string, unknown> = (() => {
    const { label, ...rest } = _props as ScopedParamsFixtureProps & Record<string, unknown>;
    void label;
    return rest;
  })();

  return (
    <>
    <div className={"scoped-params-fixture"} {...attrs} data-rozie-s-94f3adc8="">
      {(props.renderItem ?? props.slots?.['item'])?.({ value: props.label })}
    </div>
    </>
  );
}
