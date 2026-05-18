import type { ReactNode } from 'react';

interface NestedSlotsFixtureProps {
  renderWrapper?: () => ReactNode;
  renderInner?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function NestedSlotsFixture(props: NestedSlotsFixtureProps): JSX.Element {
  return (
    <>
    <div className={"nested-slots-fixture"} data-rozie-s-4d5488e4="">
      {(props.renderWrapper ?? props.slots?.['wrapper']) ? ((props.renderWrapper ?? props.slots?.['wrapper']) as Function)() : <div className={"wrapper-fallback"} data-rozie-s-4d5488e4="">
          {(props.renderInner ?? props.slots?.['inner'])?.()}
        </div>}
    </div>
    </>
  );
}
