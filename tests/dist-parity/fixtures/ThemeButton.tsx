import { useContext } from 'react';
import { clsx, rozieContext, rozieDisplay } from '@rozie/runtime-react';
import './ThemeButton.css';

interface ThemeButtonProps {}

export default function ThemeButton(props: ThemeButtonProps): JSX.Element {
  const theme = useContext(rozieContext("theme"));
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <button data-theme-button="" type="button" {...attrs} className={clsx("theme-button", (attrs.className as string | undefined))} onClick={($event) => { theme && theme.cycle(); }} data-rozie-s-9f40a7ea="">
      {rozieDisplay(theme && theme.color)}
    </button>
    </>
  );
}
