import type { JSX } from 'solid-js';
import { splitProps, useContext } from 'solid-js';
import { rozieContext, rozieDisplay } from '@rozie/runtime-solid';

interface InjectAsCastProps {}

export default function InjectAsCast(_props: InjectAsCastProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const theme = (useContext(rozieContext("theme"))) as {
    color: string;
    cycle: () => void;
  } | undefined;

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f072667f=""><button onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { theme && theme.cycle(); }} data-rozie-s-f072667f="">{rozieDisplay(theme && theme.color)}</button></div>
    </>
  );
}
