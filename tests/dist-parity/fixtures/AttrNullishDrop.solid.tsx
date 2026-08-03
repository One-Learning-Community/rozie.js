import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { rozieAttr, rozieDisplay } from '@rozie/runtime-solid';

interface AttrNullishDropProps {
  maybeNullProp?: (string) | null;
}

export default function AttrNullishDrop(_props: AttrNullishDropProps): JSX.Element {
  const _merged = mergeProps({ maybeNullProp: null }, _props);
  const [local, attrs] = splitProps(_merged, ['maybeNullProp']);

  const [cond, setCond] = createSignal(false);
  const [maybeNull, setMaybeNull] = createSignal<any>(null);
  const [loopItems, setLoopItems] = createSignal(['a', 'b']);

  return (
    <>
    <div {...attrs} class={"attr-nullish-drop" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f2d28246="">
      <span data-x={rozieAttr(cond() ? 'v' : null)} aria-expanded={rozieAttr(cond() ? 'true' : 'false')} title={rozieAttr(maybeNull())} data-rozie-s-f2d28246="">probe</span>
      <span class={"attr-nullish-drop-prop"} title={rozieAttr(local.maybeNullProp)} data-rozie-s-f2d28246="">probe-prop</span>
      <Key each={loopItems() as readonly any[]} by={(c) => c}>{(c) => <i class={"attr-nullish-drop-loop"} title={rozieAttr(local.maybeNullProp)} data-rozie-s-f2d28246="">{rozieDisplay(c())}</i>}</Key>
    </div>
    </>
  );
}
