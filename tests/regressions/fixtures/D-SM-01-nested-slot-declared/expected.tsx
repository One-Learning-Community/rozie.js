import type { ReactNode } from 'react';
import styles from './NestedSlotDeclared.module.css';

interface NestedSlotDeclaredProps {
  renderWrapper?: ReactNode;
  renderInner?: ReactNode;
}

export default function NestedSlotDeclared(props: NestedSlotDeclaredProps): JSX.Element {
  return (
    <>
    <div className={styles.outer} data-rozie-s-3bc5be6c="">
      
      {props.renderWrapper ?? <div className={styles["wrapper-fallback"]} data-rozie-s-3bc5be6c="">
          {props.renderInner}
        </div>}
    </div>
    </>
  );
}
