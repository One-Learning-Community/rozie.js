import type { ReactNode } from 'react';

interface DefaultSlotFixtureProps {
  children?: ReactNode;
}

export default function DefaultSlotFixture(props: DefaultSlotFixtureProps): JSX.Element {
  return (
    <>
    <div className={"default-slot-fixture"} data-rozie-s-9a40ef5a="">
      {props.children}
    </div>
    </>
  );
}
