import type { ReactNode } from 'react';

interface NestedSlotsFixtureProps {
  renderWrapper?: ReactNode;
  renderInner?: ReactNode;
}

export default function NestedSlotsFixture(props: NestedSlotsFixtureProps): JSX.Element {
  return (
    <>
    <div className={"nested-slots-fixture"} data-rozie-s-9d78e229="">
      {props.renderWrapper ?? <div className={"wrapper-fallback"} data-rozie-s-9d78e229="">
          {props.renderInner}
        </div>}
    </div>
    </>
  );
}
