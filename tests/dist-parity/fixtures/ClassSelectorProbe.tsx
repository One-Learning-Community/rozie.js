import { useEffect, useState } from 'react';
import { clsx, rozieAttr } from '@rozie/runtime-react';
import './ClassSelectorProbe.css';

interface ClassSelectorProbeProps {}

export default function ClassSelectorProbe(props: ClassSelectorProbeProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [ready, setReady] = useState(false);

  // script-position class-selector helper call — exercises the rewriteScript.ts
  // hook. Lowers per-target: ".grip" literal (Vue/Svelte/Solid/Angular/Lit) or
  // "." + styles.grip (React).
  const gripSelector = "." + "grip";

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <>
    <div data-handle={rozieAttr('.' + 'panel')} data-grip={rozieAttr(gripSelector)} {...attrs} className={clsx("panel", (attrs.className as string | undefined))} data-rozie-s-899140be="">
      <span className={"grip"} aria-hidden="true" data-rozie-s-899140be="">⋮⋮</span>
      {!!(ready) && <span data-rozie-s-899140be="">ready</span>}</div>
    </>
  );
}
