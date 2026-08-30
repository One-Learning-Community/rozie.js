import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieContext } from '@rozie/runtime-react';
import './ThemeProvider.css';

interface ThemeProviderProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function ThemeProvider(props: ThemeProviderProps): JSX.Element {
  const __ctx_theme = rozieContext("theme");
  const attrs = props as Record<string, unknown>;
  const [color, setColor] = useState('red');

  // The cycle order. A plain module constant — never reassigned.
  const NEXT = useMemo(() => ({
    red: 'green',
    green: 'blue',
    blue: 'red'
  }), []);
  function cycle() {
    setColor(prev => NEXT[prev]);
  }

  // Publish the live theme. The GETTER is load-bearing (D-3 / REQ-29): reading
  // `theme.color` at depth always reflects the current reactive `$data.color`,
  // so clicking through `cycle()` cycles the displayed color at depth (the
  // reactive round-trip). Snapshotting the primitive here (`{ color: $data.color }`)
  // would freeze it at provide-time and kill the round-trip.

  return (
    <__ctx_theme.Provider value={{
  get color() {
    return color;
  },
  cycle
}}>
    <>
    <div data-theme-provider="" {...attrs} className={clsx("theme-provider", (attrs.className as string | undefined))} data-rozie-s-00821bac="">
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
    </__ctx_theme.Provider>
  );
}
