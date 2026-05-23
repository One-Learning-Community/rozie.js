import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <Producer data-rozie-s-bd0c3708="" headerSlot={() => (<>
        <h2 data-rozie-s-bd0c3708="">Custom Header</h2>
      </>)}>
      Custom body content
    </Producer>
    </>
  );
}
