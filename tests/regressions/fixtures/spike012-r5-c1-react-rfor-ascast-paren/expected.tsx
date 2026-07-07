import { useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface RforAsCastParenProps {}

export default function RforAsCastParen(props: RforAsCastParenProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [items, setItems] = useState([1, 2, 3]);

  function noop(): void {}

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-1453ae2b=""><ul data-rozie-s-1453ae2b="">{(items as number[]).map((it) => <li key={it} data-rozie-s-1453ae2b="">{rozieDisplay(it)}</li>)}</ul></div>
    </>
  );
}
