import { clsx } from '@rozie/runtime-react';
import './PropDocs.css';

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
  const props: Omit<PropDocsProps, 'label' | 'count'> & { label: string; count: number } = {
    ..._props,
    label: _props.label ?? '',
    count: _props.count ?? 0,
  };
  const attrs: Record<string, unknown> = (() => {
    const { label, count, ...rest } = _props as PropDocsProps & Record<string, unknown>;
    void label; void count;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx("prop-docs", (attrs.className as string | undefined))} data-rozie-s-727424de="">
      <span className={"label"} data-rozie-s-727424de="">{props.label}</span>
      <span className={"count"} data-rozie-s-727424de="">{props.count}</span>
    </div>
    </>
  );
}
