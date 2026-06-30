import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { rozieAttr } from '@rozie/runtime-solid';

interface AttrNullishDropProps {}

export default function AttrNullishDrop(_props: AttrNullishDropProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [cond, setCond] = createSignal(false);
  const [maybeNull, setMaybeNull] = createSignal<any>(null);

  return (
    <>
    <div {...attrs} class={"attr-nullish-drop" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f2d28246="">
      <span data-x={rozieAttr(cond() ? 'v' : null)} aria-expanded={rozieAttr(cond() ? 'true' : 'false')} title={rozieAttr(maybeNull())} data-rozie-s-f2d28246="">probe</span>
    </div>
    </>
  );
}
