import { useMemo } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface ComputedAsCastProps {
  raw?: string;
}

export default function ComputedAsCast(_props: ComputedAsCastProps): JSX.Element {
  const props: Omit<ComputedAsCastProps, 'raw'> & { raw: string } = {
    ..._props,
    raw: _props.raw ?? '',
  };
  const attrs: Record<string, unknown> = (() => {
    const { raw, ...rest } = _props as ComputedAsCastProps & Record<string, unknown>;
    void raw;
    return rest;
  })();
  const label = useMemo(() => ((props.raw + '!') as string), [props.raw]);

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-6ad03933="">{rozieDisplay(label)}</div>
    </>
  );
}
