import { useState } from 'react';
import { clsx } from '@rozie/runtime-react';
import styles from './RModelLazy.module.css';

interface RModelLazyProps {}

export default function RModelLazy(props: RModelLazyProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [draft, setDraft] = useState('');

  return (
    <>
    <div {...attrs} className={clsx(styles["rmodel-lazy"], (attrs.className as string | undefined))} data-rozie-s-34fe9f5a="">
      <input type="text" placeholder="Commit on blur" defaultValue={draft} onBlur={e => setDraft(e.target.value)} data-rozie-s-34fe9f5a="" />
      <p className={styles.echo} data-rozie-s-34fe9f5a="">Committed: {draft}</p>
    </div>
    </>
  );
}
