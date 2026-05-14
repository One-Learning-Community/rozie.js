import type { ReactNode } from 'react';
import styles from './NestedSlotDeclared.module.css';

interface NestedSlotDeclaredProps {
  renderWrapper?: ReactNode;
  renderInner?: ReactNode;
}

export default function NestedSlotDeclared(props: NestedSlotDeclaredProps): JSX.Element {
  return (
    <>
    <div className={styles.outer}>
      
      {props.renderWrapper ?? <div className={styles["wrapper-fallback"]}>
          {props.renderInner}
        </div>}
    </div>
    </>
  );
}
