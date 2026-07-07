import { useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieContext } from '@rozie/runtime-react';

interface ProvideAsCastProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function ProvideAsCast(props: ProvideAsCastProps): JSX.Element {
  const __ctx_theme = rozieContext("theme");
  const attrs = props as Record<string, unknown>;
  const [color, setColor] = useState('red');

  return (
    <__ctx_theme.Provider value={{
  get color(): string {
    return color;
  }
}}>
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-bf70abc5="">{(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}</div>
    </>
    </__ctx_theme.Provider>
  );
}
