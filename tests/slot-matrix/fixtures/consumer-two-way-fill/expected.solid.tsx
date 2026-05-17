import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import Producer from './producer';
import Inner from './producer';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  const [outerOpen, setOuterOpen] = createSignal(true);
  const [innerVal, setInnerVal] = createSignal('hello');

  return (
    <>
    <Producer open={outerOpen()} onOpenChange={setOuterOpen} footerSlot={({ close }) => (<>
        <Inner open={outerOpen()} onOpenChange={setOuterOpen} />
        <button onClick={close} data-rozie-s-bd0c3708="">×</button>
      </>)} />
    </>
  );
}
