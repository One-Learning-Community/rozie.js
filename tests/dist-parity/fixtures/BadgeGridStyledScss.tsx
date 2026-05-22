import styles from './BadgeGridStyledScss.module.css';

interface BadgeGridStyledScssProps {
  badges?: any[];
}

export default function BadgeGridStyledScss(_props: BadgeGridStyledScssProps): JSX.Element {
  const props: BadgeGridStyledScssProps & { badges: any[] } = {
    ..._props,
    badges: _props.badges ?? (() => [])(),
  };

  return (
    <>
    <div className={styles["badge-grid"]} data-rozie-s-44801268="">
      {props.badges.map((badge) => <span key={badge} className={`${styles.badge} ${styles["badge--neutral"]}`} data-rozie-s-44801268="">
        {badge}
      </span>)}
    </div>
    </>
  );
}
