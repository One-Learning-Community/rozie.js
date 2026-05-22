import type { ReactNode } from 'react';

interface PresenceCheckFixtureProps {
  renderAside?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function PresenceCheckFixture(props: PresenceCheckFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div className={"presence-check-fixture"} {...attrs} data-rozie-s-313bf282="">
      {((props.renderAside ?? props.slots?.['aside'])) && <aside data-rozie-s-313bf282="">
        {(props.renderAside ?? props.slots?.['aside'])?.()}
      </aside>}</div>
    </>
  );
}
