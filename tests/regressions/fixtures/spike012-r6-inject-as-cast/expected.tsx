import { useContext } from 'react';
import { clsx, rozieContext, rozieDisplay } from '@rozie/runtime-react';

interface InjectAsCastProps {}

export default function InjectAsCast(props: InjectAsCastProps): JSX.Element {
  const theme = (useContext(rozieContext("theme"))) as {
    color: string;
    cycle: () => void;
  } | undefined;
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx("r", (attrs.className as string | undefined))} data-rozie-s-f072667f=""><button onClick={($event) => { theme && theme.cycle(); }} data-rozie-s-f072667f="">{rozieDisplay(theme && theme.color)}</button></div>
    </>
  );
}
