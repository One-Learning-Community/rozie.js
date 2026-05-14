import type { ReactNode } from 'react';

interface DefaultSlotFixtureProps {
  children?: ReactNode;
}

export default function DefaultSlotFixture(props: DefaultSlotFixtureProps): JSX.Element {
  return (
    <>
    <div className={"default-slot-fixture"}>
      {props.children}
    </div>
    </>
  );
}
