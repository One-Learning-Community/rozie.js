import type { JSX } from 'solid-js';
import { createMemo, createSignal, splitProps } from 'solid-js';
import { createDebouncedHandler, mergeListeners } from '@rozie/runtime-solid';

interface ComputedInDebounceLiftProps {}

export default function ComputedInDebounceLift(_props: ComputedInDebounceLiftProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [q, setQ] = createSignal('');
  const label = createMemo(() => 'x');

  const _rozieDebouncedHandler0 = createDebouncedHandler(($event: any) => { setQ(label()); }, 300);

  return (
    <>
    <input {...attrs} {...mergeListeners({ onInput: _rozieDebouncedHandler0 }, attrs)} data-rozie-s-e598eaaa="" />
    </>
  );
}
