import type { ReactNode } from 'react';

interface PresenceCheckFixtureProps {
  renderAside?: ReactNode;
}

export default function PresenceCheckFixture(props: PresenceCheckFixtureProps): JSX.Element {
  return (
    <>
    <div className={"presence-check-fixture"} data-rozie-s-65799b64="">
      {(props.renderAside) && <aside data-rozie-s-65799b64="">
        {props.renderAside}
      </aside>}</div>
    </>
  );
}
