import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { createControllableSignal, rozieDisplay } from '@rozie/runtime-solid';

interface NestedPolymorphicModelGuardProps {
  value?: string | Record<string, any>;
  defaultValue?: string | Record<string, any>;
  onValueChange?: (value: string | Record<string, any>) => void;
}

export default function NestedPolymorphicModelGuard(_props: NestedPolymorphicModelGuardProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<string | Record<string, any>>(_props as unknown as Record<string, unknown>, 'value', '');

  function selected(): string {
    if (true) {
      return typeof value() === 'string' ? value() : '';
    }
    return '';
  }

  return (
    <>
    <div {...attrs} class={"selected" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-52bd8447="">{rozieDisplay(selected())}</div>
    </>
  );
}
