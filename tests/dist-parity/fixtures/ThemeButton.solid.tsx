import type { JSX } from 'solid-js';
import { splitProps, useContext } from 'solid-js';
import { __rozieInjectStyle, mergeListeners, rozieContext, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('ThemeButton-9f40a7ea', `.theme-button[data-rozie-s-9f40a7ea] {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  cursor: pointer;
}`);

interface ThemeButtonProps {}

export default function ThemeButton(_props: ThemeButtonProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const theme = useContext(rozieContext('theme'));

  return (
    <>
    <button data-theme-button="" type="button" {...attrs} class={"theme-button" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...mergeListeners({ onClick: ($event) => { theme && theme.cycle(); } }, attrs)} data-rozie-s-9f40a7ea="">
      {rozieDisplay(theme && theme.color)}
    </button>
    </>
  );
}
