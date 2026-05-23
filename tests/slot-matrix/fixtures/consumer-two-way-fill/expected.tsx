import { useState } from 'react';
import Producer from './producer';
import Inner from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerVal, setInnerVal] = useState('hello');

  return (
    <>
    <Producer open={outerOpen} onOpenChange={setOuterOpen} data-rozie-s-bd0c3708="" renderFooter={({ close }) => (<>
        <Inner open={outerOpen} onOpenChange={setOuterOpen} data-rozie-s-bd0c3708="" />
        <button onClick={close} data-rozie-s-bd0c3708="">×</button>
      </>)} />
    </>
  );
}
