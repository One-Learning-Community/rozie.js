import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import './NestedSlotDeclared.css';

interface NestedSlotDeclaredProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'renderWrapper' | 'renderInner' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  renderWrapper?: () => ReactNode;
  renderInner?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function NestedSlotDeclared(props: NestedSlotDeclaredProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { renderWrapper, renderInner, slots, ...rest } = props as NestedSlotDeclaredProps & Record<string, unknown>;
    void renderWrapper; void renderInner; void slots;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx("outer", (attrs.className as string | undefined))} data-rozie-s-3bc5be6c="">
      
      {(props.renderWrapper ?? props.slots?.['wrapper']) ? ((props.renderWrapper ?? props.slots?.['wrapper']) as Function)() : <div className={"wrapper-fallback"} data-rozie-s-3bc5be6c="">
          {(props.renderInner ?? props.slots?.['inner'])?.()}
        </div>}
    </div>
    </>
  );
}
