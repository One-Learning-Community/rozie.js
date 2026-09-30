import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { createDebouncedHandler, createThrottledHandler } from '@rozie/runtime-solid';

interface DebounceInlineCallProps extends Omit<import('solid-js').ComponentProps<'div'>, 'children' | 'innerHTML' | 'innerText' | 'textContent' | 'ref'> {}

export default function DebounceInlineCall(_props: DebounceInlineCallProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [n, setN] = createSignal(0);

  function bump(): void {
    setN(n() + 1);
  }

  const _rozieDebouncedHandler0 = createDebouncedHandler(($event: any) => { bump(); }, 300);

  const _rozieThrottledHandler1_1 = createThrottledHandler(($event: any) => { bump(); }, 200);

  return (
    <>
    <div {...attrs} class={"root" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-bbb11bc5="">
      <input class={"deb"} onInput={_rozieDebouncedHandler0} data-rozie-s-bbb11bc5="" />
      <button class={"thr"} onClick={_rozieThrottledHandler1_1} data-rozie-s-bbb11bc5="">{n()}</button>
    </div>
    </>
  );
}
