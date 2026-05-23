import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface DefaultContentFallbackFixtureProps {
  renderStatus?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function DefaultContentFallbackFixture(props: DefaultContentFallbackFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx("default-content-fallback-fixture", (attrs.className as string | undefined))} {...attrs} data-rozie-s-62104151="">
      {(props.renderStatus ?? props.slots?.['status']) ? ((props.renderStatus ?? props.slots?.['status']) as Function)() : <span className={"fallback"} data-rozie-s-62104151="">No status provided.</span>}
    </div>
    </>
  );
}
