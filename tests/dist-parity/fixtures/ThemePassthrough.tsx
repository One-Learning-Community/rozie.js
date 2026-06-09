import type { ReactNode } from 'react';
import { clsx } from '@rozie/runtime-react';
import './ThemePassthrough.css';

interface ThemePassthroughProps {
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function ThemePassthrough(props: ThemePassthroughProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div data-theme-passthrough="" {...attrs} className={clsx("theme-passthrough", (attrs.className as string | undefined))} data-rozie-s-515c25a2="">
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
  );
}
