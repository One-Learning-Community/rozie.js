import { clsx } from '@rozie/runtime-react';
import styles from './BadgeGridStyledScss.module.css';

interface BadgeGridStyledScssProps {
  badges?: any[];
}

export default function BadgeGridStyledScss(_props: BadgeGridStyledScssProps): JSX.Element {
  const props: BadgeGridStyledScssProps & { badges: any[] } = {
    ..._props,
    badges: _props.badges ?? (() => [])(),
  };
  const attrs: Record<string, unknown> = (() => {
    const { badges, ...rest } = _props as BadgeGridStyledScssProps & Record<string, unknown>;
    void badges;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx(styles["badge-grid"], (attrs.className as string | undefined))} data-rozie-s-44801268="">
      {props.badges.map((badge) => <span key={badge} className={`${styles.badge} ${styles["badge--neutral"]}`} data-rozie-s-44801268="">
        {badge}
      </span>)}
    </div>
    </>
  );
}
