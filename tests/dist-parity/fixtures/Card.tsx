import type { ReactNode } from 'react';
import styles from './Card.module.css';
import CardHeader from './CardHeader';

interface CardProps {
  title?: string;
  onClose?: (...args: any[]) => any;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Card(_props: CardProps): JSX.Element {
  const props: CardProps & { title: string } = {
    ..._props,
    title: _props.title ?? '',
  };

  return (
    <>
    <article className={styles.card} data-rozie-s-a88c221e="">
      <CardHeader title={props.title} onClose={props.onClose} />
      <div className={styles.card__body} data-rozie-s-a88c221e="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
      </div>
    </article>
    </>
  );
}
