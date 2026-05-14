import type { ReactNode } from 'react';

interface NestedSlotsFixtureProps {
  renderWrapper?: ReactNode;
}

export default function NestedSlotsFixture(props: NestedSlotsFixtureProps): JSX.Element {
  return (
    <>
    <div className={"nested-slots-fixture"}>
      {props.renderWrapper ?? <div className={"wrapper-fallback"}>
          {props.renderInner}
        </div>}
    </div>
    </>
  );
}
