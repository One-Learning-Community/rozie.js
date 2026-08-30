import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieContext } from '@rozie/runtime-react';
import './Tabs.css';

interface TabsProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Tabs(props: TabsProps): JSX.Element {
  const __ctx_tabs = rozieContext("tabs");
  const attrs = props as Record<string, unknown>;
  const [active, setActive] = useState(0);

  // NOTE: this helper is intentionally NOT named `setActive` — React
  // auto-generates a `setActive` setter for the `$data.active` state field, and a
  // same-named user function collides with it (ROZ524: "already declared" +
  // infinite recursion when `$data.active = v` rewrites to `setActive(v)`). The
  // PROVIDED key is still `setActive` (the consumer-facing API); only the local
  // implementation name differs.
  function selectActive(index: any) {
    setActive(index);
  }

  // Publish the active-index API. `get active()` keeps the read live (D-3 /
  // REQ-29) so every injected Tab updates when the active selection changes —
  // no prop is passed between Tabs and any Tab. The Tab children supply their
  // own stable index explicitly (see Tab.rozie's `index` prop).

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
