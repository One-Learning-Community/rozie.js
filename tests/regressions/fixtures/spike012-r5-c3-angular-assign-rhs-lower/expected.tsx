import { useState } from 'react';
import { clsx, useControllableState, useDebouncedCallback } from '@rozie/runtime-react';

interface Spike012R5C3Props {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export default function Spike012R5C3(props: Spike012R5C3Props): JSX.Element {
  const attrs: Record<string, unknown> = (() => {
    const { value, defaultValue, onValueChange, ...rest } = props as Spike012R5C3Props & Record<string, unknown>;
    void value; void defaultValue; void onValueChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
  const [n, setN] = useState(0);
  const [q, setQ] = useState('');

  function noop(): void {}

  const _rozieDebouncedHandler0 = useDebouncedCallback(($event: any) => { setValue(($event.currentTarget as HTMLInputElement).value); }, [], 300);

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-d6f96745="">
      <button onClick={($event) => { setQ(n > 0 ? 'a' : 'b'); }} data-rozie-s-d6f96745="">go</button>
      <input onInput={_rozieDebouncedHandler0} data-rozie-s-d6f96745="" />
    </div>
    </>
  );
}
