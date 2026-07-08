import type { JSX } from 'solid-js';
import { createMemo, splitProps } from 'solid-js';
import { createControllableSignal, rozieDisplay } from '@rozie/runtime-solid';

interface PolyGuardInComputedProps {
  value?: string | Record<string, any>;
  defaultValue?: string | Record<string, any>;
  onValueChange?: (value: string | Record<string, any>) => void;
}

export default function PolyGuardInComputed(_props: PolyGuardInComputedProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<string | Record<string, any>>(_props as unknown as Record<string, unknown>, 'value', '');
  const asStr = createMemo(() => {
    const v = value();
    return typeof v === 'string' ? v : '';
  });
  const shout = createMemo(() => asStr().toUpperCase());

  return (
    <>
    <div {...attrs} class={"poly-guard-in-computed" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-537a5827="">{rozieDisplay(shout())}</div>
    </>
  );
}
