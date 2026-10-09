import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface PresenceCheckFixtureProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'renderAside' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  renderAside?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function PresenceCheckFixture(props: PresenceCheckFixtureProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { renderAside, slots, ...rest } = props as PresenceCheckFixtureProps & Record<string, unknown>;
    void renderAside; void slots;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx("presence-check-fixture", (attrs.className as string | undefined))} data-rozie-s-313bf282="">
      {!!((props.renderAside ?? props.slots?.['aside'])) && <aside data-rozie-s-313bf282="">
        {(props.renderAside ?? props.slots?.['aside'])?.()}
      </aside>}</div>
    </>
  );
}
