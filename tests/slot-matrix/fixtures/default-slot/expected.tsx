import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface DefaultSlotFixtureProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function DefaultSlotFixture(props: DefaultSlotFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx("default-slot-fixture", (attrs.className as string | undefined))} {...attrs} data-rozie-s-61728cb8="">
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
  );
}
