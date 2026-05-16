import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <Producer headerSlot={({ close }) => (<>
        <button onClick={close} data-rozie-s-bd0c3708="">×</button>
      </>)}>
      Body text
    </Producer>
    </>
  );
}
