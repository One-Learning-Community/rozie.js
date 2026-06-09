import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieContext } from '@rozie/runtime-react';
import './Tabs.css';

interface TabsProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Tabs(props: TabsProps): JSX.Element {
  const __ctx_tabs = rozieContext('tabs');
  const attrs = props as Record<string, unknown>;
  const [active, setActive] = useState(0);

  function selectActive(index: any) {
    setActive(index);
  }

  return (
    <__ctx_tabs.Provider value={{
  get active() {
    return active;
  },
  setActive: selectActive
}}>
    <>
    <div data-tabs="" role="tablist" {...attrs} className={clsx("tabs", (attrs.className as string | undefined))} data-rozie-s-97e2d32a="">
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
    </__ctx_tabs.Provider>
  );
}
