import { useState } from 'react';
import styles from './RModelLazy.module.css';

interface RModelLazyProps {}

export default function RModelLazy(props: RModelLazyProps): JSX.Element {
  const [draft, setDraft] = useState('');

  return (
    <>
    <div className={styles["rmodel-lazy"]} data-rozie-s-34fe9f5a="">
      <input type="text" placeholder="Commit on blur" defaultValue={draft} onBlur={e => setDraft(e.target.value)} data-rozie-s-34fe9f5a="" />
      <p className={styles.echo} data-rozie-s-34fe9f5a="">Committed: {draft}</p>
    </div>
    </>
  );
}
