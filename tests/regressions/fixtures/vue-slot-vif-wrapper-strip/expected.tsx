import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import './PresenceSlotFallback.css';

interface PresenceSlotFallbackProps {
  title?: string;
  renderHeader?: () => ReactNode;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function PresenceSlotFallback(_props: PresenceSlotFallbackProps): JSX.Element {
  const props: Omit<PresenceSlotFallbackProps, 'title'> & { title: string } = {
    ..._props,
    title: _props.title ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { title, ...rest } = _props as PresenceSlotFallbackProps & Record<string, unknown>;
    void title;
    return rest;
  })();

  return (
    <>
    <section {...attrs} className={clsx("panel", (attrs.className as string | undefined))} data-rozie-s-224e77e7="">
      {((props.renderHeader ?? props.slots?.['header']) || props.title) && <header data-rozie-s-224e77e7="">
        
        {(props.renderHeader ?? props.slots?.['header']) ? ((props.renderHeader ?? props.slots?.['header']) as Function)() : props.title}
      </header>}<div className={"body"} data-rozie-s-224e77e7="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
      </div>
    </section>
    </>
  );
}
