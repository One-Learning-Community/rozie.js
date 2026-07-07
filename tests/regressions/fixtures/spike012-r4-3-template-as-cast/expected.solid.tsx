import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface TemplateAsCastProps {}

export default function TemplateAsCast(_props: TemplateAsCastProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [q, setQ] = createSignal('');
  const [n, setN] = createSignal(0);

  function noop(): void {}

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-18b4a8ad="">
      <input onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { setQ(($event.currentTarget as HTMLInputElement).value); }} data-rozie-s-18b4a8ad="" />
      <span data-rozie-s-18b4a8ad="">{rozieDisplay((n() as number).toFixed(0))}</span>
    </div>
    </>
  );
}
