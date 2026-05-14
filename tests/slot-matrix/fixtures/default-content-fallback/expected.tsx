import type { ReactNode } from 'react';

interface DefaultContentFallbackFixtureProps {
  renderStatus?: ReactNode;
}

export default function DefaultContentFallbackFixture(props: DefaultContentFallbackFixtureProps): JSX.Element {
  return (
    <>
    <div className={"default-content-fallback-fixture"}>
      {props.renderStatus ?? <span className={"fallback"}>No status provided.</span>}
    </div>
    </>
  );
}
