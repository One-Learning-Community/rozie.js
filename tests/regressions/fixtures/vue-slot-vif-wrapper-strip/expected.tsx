import type { ReactNode } from 'react';
import styles from './PresenceSlotFallback.module.css';

interface PresenceSlotFallbackProps {
  title?: string;
  renderHeader?: ReactNode;
  children?: ReactNode;
}

export default function PresenceSlotFallback(_props: PresenceSlotFallbackProps): JSX.Element {
  const props: PresenceSlotFallbackProps = {
    ..._props,
    title: _props.title ?? '',
  };

  return (
    <>
    <section className={styles.panel}>
      {(props.renderHeader || props.title) && <header>
        
        {props.renderHeader ?? props.title}
      </header>}<div className={styles.body}>
        {props.children}
      </div>
    </section>
    </>
  );
}
