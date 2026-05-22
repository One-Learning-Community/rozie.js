import type { ReactNode } from 'react';

interface DefaultContentFallbackFixtureProps {
  renderStatus?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function DefaultContentFallbackFixture(props: DefaultContentFallbackFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div className={"default-content-fallback-fixture"} {...attrs} data-rozie-s-62104151="">
      {(props.renderStatus ?? props.slots?.['status']) ? ((props.renderStatus ?? props.slots?.['status']) as Function)() : <span className={"fallback"} data-rozie-s-62104151="">No status provided.</span>}
    </div>
    </>
  );
}
