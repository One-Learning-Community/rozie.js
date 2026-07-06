import type { JSX } from 'solid-js';
import { mergeProps, splitProps, useContext } from 'solid-js';
import { __rozieInjectStyle, mergeListeners, rozieAttr, rozieClass, rozieContext } from '@rozie/runtime-solid';

__rozieInjectStyle('Tab-18645a16', `.tab[data-rozie-s-18645a16] {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 0.375rem 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.tab.is-active[data-rozie-s-18645a16] {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}`);

interface TabProps {
  label?: string;
  index?: number;
}

export default function Tab(_props: TabProps): JSX.Element {
  const _merged = mergeProps({ label: '', index: 0 }, _props);
  const [local, attrs] = splitProps(_merged, ['label', 'index']);

  const tabs = useContext(rozieContext("tabs"));

  return (
    <>
    <button data-tab="" type="button" role="tab" data-active={rozieAttr(tabs && tabs.active === local.index)} {...attrs} class={"tab" + " " + rozieClass({ 'is-active': tabs && tabs.active === local.index }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...mergeListeners({ onClick: ($event: MouseEvent) => { tabs && tabs.setActive(local.index); } }, attrs)} data-rozie-s-18645a16="">
      {local.label}
    </button>
    </>
  );
}
