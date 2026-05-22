import { useEffect, useState } from 'react';
import styles from './ClassSelectorProbe.module.css';

interface ClassSelectorProbeProps {}

export default function ClassSelectorProbe(props: ClassSelectorProbeProps): JSX.Element {
  const [ready, setReady] = useState(false);

  // script-position class-selector helper call — exercises the rewriteScript.ts
  // hook. Lowers per-target: ".grip" literal (Vue/Svelte/Solid/Angular/Lit) or
  // "." + styles.grip (React).
  const gripSelector = "." + styles.grip;

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <>
    <div className={styles.panel} data-handle={'.' + styles.panel} data-grip={gripSelector} data-rozie-s-899140be="">
      <span className={styles.grip} aria-hidden="true" data-rozie-s-899140be="">⋮⋮</span>
      {(ready) && <span data-rozie-s-899140be="">ready</span>}</div>
    </>
  );
}
