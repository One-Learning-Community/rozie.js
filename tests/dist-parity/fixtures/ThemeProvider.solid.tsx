import type { JSX } from 'solid-js';
import { children, createSignal, splitProps } from 'solid-js';
import { __rozieInjectStyle, rozieContext } from '@rozie/runtime-solid';

__rozieInjectStyle('ThemeProvider-00821bac', `.theme-provider[data-rozie-s-00821bac] {
  display: block;
}`);

interface ThemeProviderProps {
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function ThemeProvider(_props: ThemeProviderProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['children']);
  const resolved = children(() => local.children);

  const __ctx_theme = rozieContext('theme');
  const [color, setColor] = createSignal('red');

  // The cycle order. A plain module constant — never reassigned.
  const NEXT = {
    red: 'green',
    green: 'blue',
    blue: 'red'
  };
  function cycle() {
    setColor(NEXT[color()]);
  }

  // Publish the live theme. The GETTER is load-bearing (D-3 / REQ-29): reading
  // `theme.color` at depth always reflects the current reactive `$data.color`,
  // so clicking through `cycle()` cycles the displayed color at depth (the
  // reactive round-trip). Snapshotting the primitive here (`{ color: $data.color }`)
  // would freeze it at provide-time and kill the round-trip.

  return (
    <__ctx_theme.Provider value={{
  get color() {
    return color();
  },
  cycle
}}>
    <>
    <div data-theme-provider="" {...attrs} class={"theme-provider" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-00821bac="">
      {resolved()}
    </div>
    </>
    </__ctx_theme.Provider>
  );
}
