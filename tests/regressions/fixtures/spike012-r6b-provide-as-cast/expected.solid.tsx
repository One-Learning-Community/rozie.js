import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { rozieContext } from '@rozie/runtime-solid';

interface ProvideAsCastProps {
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function ProvideAsCast(_props: ProvideAsCastProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['children']);
  const resolved = () => local.children;

  const __ctx_theme = rozieContext("theme");
  const [color, setColor] = createSignal('red');

  return (
    <__ctx_theme.Provider value={{
  get color(): string {
    return color();
  }
}}>
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-bf70abc5="">{resolved()}</div>
    </>
    </__ctx_theme.Provider>
  );
}
