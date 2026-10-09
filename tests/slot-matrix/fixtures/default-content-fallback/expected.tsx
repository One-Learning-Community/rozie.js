import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface DefaultContentFallbackFixtureProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'renderStatus' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  renderStatus?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function DefaultContentFallbackFixture(props: DefaultContentFallbackFixtureProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { renderStatus, slots, ...rest } = props as DefaultContentFallbackFixtureProps & Record<string, unknown>;
    void renderStatus; void slots;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx("default-content-fallback-fixture", (attrs.className as string | undefined))} data-rozie-s-62104151="">
      {(props.renderStatus ?? props.slots?.['status']) ? ((props.renderStatus ?? props.slots?.['status']) as Function)() : <span className={"fallback"} data-rozie-s-62104151="">No status provided.</span>}
    </div>
    </>
  );
}
