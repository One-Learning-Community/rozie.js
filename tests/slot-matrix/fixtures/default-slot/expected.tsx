import type { ReactNode } from 'react';

interface DefaultSlotFixtureProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function DefaultSlotFixture(props: DefaultSlotFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div className={"default-slot-fixture"} {...attrs} data-rozie-s-61728cb8="">
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
  );
}
