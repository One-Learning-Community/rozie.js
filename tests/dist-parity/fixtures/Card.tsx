import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './Card.module.css';
import CardHeader from './CardHeader';

interface CardProps {
  title?: string;
  onClose?: ((...args: any[]) => any) | null;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Card(_props: CardProps): JSX.Element {
  const props: Omit<CardProps, 'title' | 'onClose'> & { title: string; onClose: ((...args: any[]) => any) | null } = {
    ..._props,
    title: _props.title ?? '',
    onClose: _props.onClose ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { title, onClose, ...rest } = _props as CardProps & Record<string, unknown>;
    void title; void onClose;
    return rest;
  })();

  return (
    <>
    <article {...attrs} className={clsx(styles.card, (attrs.className as string | undefined))} data-rozie-s-a88c221e="">
      <CardHeader title={props.title} onClose={props.onClose} data-rozie-s-a88c221e="" />
      <div className={styles.card__body} data-rozie-s-a88c221e="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
      </div>
    </article>
    </>
  );
}
