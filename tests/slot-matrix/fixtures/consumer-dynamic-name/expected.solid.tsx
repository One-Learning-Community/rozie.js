import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  const [slotName, setSlotName] = createSignal('a');

  return (
    <>
    <Producer slots={{ [slotName()]: () => (<>Dynamic fill</>) }} />
    </>
  );
}
