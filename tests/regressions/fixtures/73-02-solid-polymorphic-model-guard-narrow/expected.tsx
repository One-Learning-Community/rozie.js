import { clsx, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './PolymorphicModelGuardNarrow.css';

interface PolymorphicModelGuardNarrowProps {
  value?: string | Record<string, any>;
  defaultValue?: string | Record<string, any>;
  onValueChange?: (value: string | Record<string, any>) => void;
}

export default function PolymorphicModelGuardNarrow(props: PolymorphicModelGuardNarrowProps): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { value, defaultValue, onValueChange, ...rest } = props as PolymorphicModelGuardNarrowProps & Record<string, unknown>;
    void value; void defaultValue; void onValueChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });

  function selected(): string {
    return typeof value === 'string' ? value : '';
  }

  return (
    <>
    <div {...attrs} className={clsx("selected", (attrs.className as string | undefined))} data-rozie-s-afea58c3="">{rozieDisplay(selected())}</div>
    </>
  );
}
