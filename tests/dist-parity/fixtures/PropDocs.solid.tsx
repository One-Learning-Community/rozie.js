import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('PropDocs-727424de', `.prop-docs[data-rozie-s-727424de] { display: inline-flex; gap: 0.5rem; align-items: center; }
.label[data-rozie-s-727424de] { font-weight: 600; }
.count[data-rozie-s-727424de] { font-variant-numeric: tabular-nums; }`);

interface PropDocsProps {
  /**
   * The visible text label for the control.
   * @deprecated Use `text` instead — `label` is retained only for back-compat.
   * @example
   * <PropDocs label="Save" />
   */
  label?: string;
  count?: number;
}

export default function PropDocs(_props: PropDocsProps): JSX.Element {
  const _merged = mergeProps({ label: '', count: 0 }, _props);
  const [local, attrs] = splitProps(_merged, ['label', 'count']);

  return (
    <>
    <div {...attrs} class={"prop-docs" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-727424de="">
      <span class={"label"} data-rozie-s-727424de="">{local.label}</span>
      <span class={"count"} data-rozie-s-727424de="">{local.count}</span>
    </div>
    </>
  );
}
