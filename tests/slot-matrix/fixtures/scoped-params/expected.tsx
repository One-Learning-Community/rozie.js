import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

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
    <div {...attrs} className={clsx("scoped-params-fixture", (attrs.className as string | undefined))} data-rozie-s-94f3adc8="">
      {(props.renderItem ?? props.slots?.['item'])?.({ value: props.label })}
    </div>
    </>
  );
}
