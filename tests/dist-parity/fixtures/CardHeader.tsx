import { clsx } from '@rozie/runtime-react';
import styles from './CardHeader.module.css';

interface CardHeaderProps {
  title?: string;
  onClose?: (...args: any[]) => any;
}

export default function CardHeader(_props: CardHeaderProps): JSX.Element {
  const props: CardHeaderProps & { title: string } = {
    ..._props,
    title: _props.title ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { title, onClose, ...rest } = _props as CardHeaderProps & Record<string, unknown>;
    void title; void onClose;
    return rest;
  })();

  return (
    <>
    <header {...attrs} className={clsx(styles["card-header"], (attrs.className as string | undefined))} data-rozie-s-f3e60f5a="">
      <h3 className={styles["card-header__title"]} data-rozie-s-f3e60f5a="">{props.title}</h3>
      {(props.onClose) && <button className={styles["card-header__close"]} onClick={($event) => { ((props.onClose) as ((...args: any[]) => any) | undefined)?.($event); }} data-rozie-s-f3e60f5a="">×</button>}</header>
    </>
  );
}
