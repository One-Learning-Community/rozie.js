import { useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';

interface TemplateAsCastProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'children' | 'dangerouslySetInnerHTML'> {}

export default function TemplateAsCast(props: TemplateAsCastProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [q, setQ] = useState('');
  const [n, setN] = useState(0);

  function noop(): void {}

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-18b4a8ad="">
      <input onInput={($event) => { setQ(($event.currentTarget as HTMLInputElement).value); }} data-rozie-s-18b4a8ad="" />
      <span data-rozie-s-18b4a8ad="">{rozieDisplay((n as number).toFixed(0))}</span>
    </div>
    </>
  );
}
