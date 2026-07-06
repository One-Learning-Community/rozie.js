import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { createControllableSignal, rozieDisplay } from '@rozie/runtime-solid';

interface LogicalGuardNarrowProps {
  value?: string | Record<string, any>;
  defaultValue?: string | Record<string, any>;
  onValueChange?: (value: string | Record<string, any>) => void;
}

export default function LogicalGuardNarrow(_props: LogicalGuardNarrowProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<string | Record<string, any>>(_props as unknown as Record<string, unknown>, 'value', '');

  function selected(): string {
    const v = value();
    return typeof v === 'string' && v.length > 0 ? v : '';
  }

  return (
    <>
    <div {...attrs} class={"selected" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-84c5a00d="">{rozieDisplay(selected())}</div>
    </>
  );
}
