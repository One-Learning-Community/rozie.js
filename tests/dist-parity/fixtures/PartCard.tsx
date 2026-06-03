import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import './PartCard.css';

interface PartCardProps {
  title?: string;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function PartCard(_props: PartCardProps): JSX.Element {
  const props: Omit<PartCardProps, 'title'> & { title: string } = {
    ..._props,
    title: _props.title ?? 'Card',
  };
  const attrs: Record<string, unknown> = (() => {
    const { title, ...rest } = _props as PartCardProps & Record<string, unknown>;
    void title;
    return rest;
  })();

  return (
    <>
    <div part="body" {...attrs} className={clsx("card-body", (attrs.className as string | undefined))} data-rozie-s-1462f7ea="">
      <h3 className={"card-title"} data-rozie-s-1462f7ea="">{props.title}</h3>
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
  );
}
