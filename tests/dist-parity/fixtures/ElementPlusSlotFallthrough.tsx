import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import './ElementPlusSlotFallthrough.css';

interface ElementPlusSlotFallthroughProps {
  variant?: string;
  renderHeader?: () => ReactNode;
  children?: ReactNode;
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function ElementPlusSlotFallthrough(_props: ElementPlusSlotFallthroughProps): JSX.Element {
  const props: Omit<ElementPlusSlotFallthroughProps, 'variant'> & { variant: string } = {
    ..._props,
    variant: _props.variant ?? 'primary',
  };
  const attrs: Record<string, unknown> = (() => {
    const { variant, ...rest } = _props as ElementPlusSlotFallthroughProps & Record<string, unknown>;
    void variant;
    return rest;
  })();

  return (
    <>
    {(props.renderHeader ?? props.slots?.['header'])?.()}
    <div {...attrs} className={clsx(clsx("epsf-root", 'epsf-root--' + props.variant), (attrs.className as string | undefined))} data-rozie-s-986e3472="">chrome</div>
    {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    {(props.renderFooter ?? props.slots?.['footer'])?.()}
    </>
  );
}
