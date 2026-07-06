import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('PolymorphicModelGuardNarrow-afea58c3', `.selected[data-rozie-s-afea58c3] { font-variant-numeric: tabular-nums; }`);

interface PolymorphicModelGuardNarrowProps {
  value?: string | Record<string, any>;
  defaultValue?: string | Record<string, any>;
  onValueChange?: (value: string | Record<string, any>) => void;
}

export default function PolymorphicModelGuardNarrow(_props: PolymorphicModelGuardNarrowProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<string | Record<string, any>>(_props as unknown as Record<string, unknown>, 'value', '');

  // project_solid_polymorphic_model_typeof_narrow_gap / emitter-hardening
  // backlog item #11: capturing the guard-and-reread pattern directly (no
  // author-side workaround) — the emitter must bind a local before the guard
  // so the narrowing holds uniformly on all six targets.
  function selected(): string {
    const v = value();
    return typeof v === 'string' ? v : '';
  }

  return (
    <>
    <div {...attrs} class={"selected" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-afea58c3="">{rozieDisplay(selected())}</div>
    </>
  );
}
