import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';

interface ChildrenCtx { title: any; }

interface SlotConditionalScopedSlotRIfProps {
  show?: boolean;
  title?: string;
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function SlotConditionalScopedSlotRIf(_props: SlotConditionalScopedSlotRIfProps): JSX.Element {
  const props: Omit<SlotConditionalScopedSlotRIfProps, 'show' | 'title'> & { show: boolean; title: string } = {
    ..._props,
    show: _props.show ?? false,
    title: _props.title ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { show, title, ...rest } = _props as SlotConditionalScopedSlotRIfProps & Record<string, unknown>;
    void show; void title;
    return rest;
  })();

  function noop(): void {}

  return (
    <>

    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-896f7201="">{!!(props.show) && (typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ title: props.title }) : (props.children ?? props.slots?.['']))}</div>
    </>
  );
}
