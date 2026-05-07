import type { ReactNode } from 'react';
import styles from './Card.module.css';
import CardHeader from './CardHeader';

interface CardProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
  children?: ReactNode;
}

export default function Card(_props: CardProps): JSX.Element {
  const props: CardProps = {
    ..._props,
    title: _props.title ?? '',
    onClose: _props.onClose ?? null,
  };

  return (
    <>
    <article className={styles.card}>
      <CardHeader title={props.title} onClose={props.onClose} />
      <div className={styles.card__body}>
        {props.children}
      </div>
    </article>
    </>
  );
}
