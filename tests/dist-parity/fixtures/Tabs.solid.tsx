import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { __rozieInjectStyle, rozieContext } from '@rozie/runtime-solid';

__rozieInjectStyle('Tabs-97e2d32a', `.tabs[data-rozie-s-97e2d32a] {
  display: flex;
  gap: 0.25rem;
  font-family: system-ui, -apple-system, sans-serif;
}`);

interface TabsProps {
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function Tabs(_props: TabsProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['children']);
  const resolved = () => local.children;

  const __ctx_tabs = rozieContext("tabs");
  const [active, setActive] = createSignal(0);

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
    return active();
  },
  setActive: selectActive
}}>
    <>
    <div data-tabs="" role="tablist" {...attrs} class={"tabs" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-97e2d32a="">
      {resolved()}
    </div>
    </>
    </__ctx_tabs.Provider>
  );
}
