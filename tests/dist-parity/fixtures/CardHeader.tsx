import styles from './CardHeader.module.css';

interface CardHeaderProps {
  title?: string;
  onClose?: (...args: unknown[]) => unknown;
}

export default function CardHeader(_props: CardHeaderProps): JSX.Element {
  const props: CardHeaderProps = {
    ..._props,
    title: _props.title ?? '',
    onClose: _props.onClose ?? null,
  };

  return (
    <>
    <header className={styles["card-header"]} data-rozie-s-f3e60f5a="">
      <h3 className={styles["card-header__title"]} data-rozie-s-f3e60f5a="">{props.title}</h3>
      {(props.onClose) && <button className={styles["card-header__close"]} onClick={(e) => { (props.onClose)(e); }} data-rozie-s-f3e60f5a="">×</button>}</header>
    </>
  );
}
