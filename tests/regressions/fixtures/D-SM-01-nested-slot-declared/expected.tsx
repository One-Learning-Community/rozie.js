import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './NestedSlotDeclared.module.css';

interface NestedSlotDeclaredProps {
  renderWrapper?: () => ReactNode;
  renderInner?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function NestedSlotDeclared(props: NestedSlotDeclaredProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx(styles.outer, (attrs.className as string | undefined))} {...attrs} data-rozie-s-3bc5be6c="">
      
      {(props.renderWrapper ?? props.slots?.['wrapper']) ? ((props.renderWrapper ?? props.slots?.['wrapper']) as Function)() : <div className={styles["wrapper-fallback"]} data-rozie-s-3bc5be6c="">
          {(props.renderInner ?? props.slots?.['inner'])?.()}
        </div>}
    </div>
    </>
  );
}
