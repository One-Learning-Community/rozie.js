import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface PresenceCheckFixtureProps {
  renderAside?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function PresenceCheckFixture(props: PresenceCheckFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx("presence-check-fixture", (attrs.className as string | undefined))} data-rozie-s-313bf282="">
      {!!((props.renderAside ?? props.slots?.['aside'])) && <aside data-rozie-s-313bf282="">
        {(props.renderAside ?? props.slots?.['aside'])?.()}
      </aside>}</div>
    </>
  );
}
