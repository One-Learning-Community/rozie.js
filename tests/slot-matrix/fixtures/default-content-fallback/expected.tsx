import type { ReactNode } from 'react';

interface DefaultContentFallbackFixtureProps {
  renderStatus?: ReactNode;
}

export default function DefaultContentFallbackFixture(props: DefaultContentFallbackFixtureProps): JSX.Element {
  return (
    <>
    <div className={"default-content-fallback-fixture"} data-rozie-s-318c6fcd="">
      {props.renderStatus ?? <span className={"fallback"} data-rozie-s-318c6fcd="">No status provided.</span>}
    </div>
    </>
  );
}
