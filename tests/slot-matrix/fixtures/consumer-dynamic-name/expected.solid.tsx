import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [slotName, setSlotName] = createSignal('a');

  return (
    <>
    <Producer data-rozie-s-bd0c3708="" slots={{ [slotName()]: () => (<>Dynamic fill</>) }} />
    </>
  );
}
