import { useContext } from 'react';
import { clsx, mergeListeners, pickListeners, rozieContext, rozieDisplay } from '@rozie/runtime-react';
import './ThemeButton.css';

interface ThemeButtonProps extends Omit<import('react').ComponentPropsWithoutRef<'button'>, 'children' | 'dangerouslySetInnerHTML'> {}

export default function ThemeButton(props: ThemeButtonProps): JSX.Element {
  const theme = useContext(rozieContext("theme"));
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <button data-theme-button="" type="button" {...attrs} className={clsx("theme-button", (attrs.className as string | undefined))} {...mergeListeners({ onClick: ($event) => { theme && theme.cycle(); } } satisfies import('react').ComponentPropsWithoutRef<'button'> & Record<string, unknown>, pickListeners(attrs))} data-rozie-s-9f40a7ea="">
      {rozieDisplay(theme && theme.color)}
    </button>
    </>
  );
}
