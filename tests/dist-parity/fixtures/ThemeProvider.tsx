import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieContext } from '@rozie/runtime-react';
import './ThemeProvider.css';

interface ThemeProviderProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function ThemeProvider(props: ThemeProviderProps): JSX.Element {
  const __ctx_theme = rozieContext('theme');
  const attrs = props as Record<string, unknown>;
  const [color, setColor] = useState('red');

  // The cycle order. A plain module constant — never reassigned.
  const NEXT = {
    red: 'green',
    green: 'blue',
    blue: 'red'
  };
  function cycle() {
    setColor(prev => NEXT[prev]);
  }

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
