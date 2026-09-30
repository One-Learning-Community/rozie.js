import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface NestedSlotsFixtureProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'renderWrapper' | 'renderInner' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  renderWrapper?: () => ReactNode;
  renderInner?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function NestedSlotsFixture(props: NestedSlotsFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx("nested-slots-fixture", (attrs.className as string | undefined))} data-rozie-s-4d5488e4="">
      {(props.renderWrapper ?? props.slots?.['wrapper']) ? ((props.renderWrapper ?? props.slots?.['wrapper']) as Function)() : <div className={"wrapper-fallback"} data-rozie-s-4d5488e4="">
          {(props.renderInner ?? props.slots?.['inner'])?.()}
        </div>}
    </div>
    </>
  );
}
