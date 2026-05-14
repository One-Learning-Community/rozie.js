import type { ReactNode } from 'react';

interface PresenceCheckFixtureProps {
  renderAside?: ReactNode;
}

export default function PresenceCheckFixture(props: PresenceCheckFixtureProps): JSX.Element {
  return (
    <>
    <div className={"presence-check-fixture"}>
      {(props.renderAside) && <aside>
        {props.renderAside}
      </aside>}</div>
    </>
  );
}
