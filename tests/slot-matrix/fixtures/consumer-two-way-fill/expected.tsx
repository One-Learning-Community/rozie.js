import { useState } from 'react';
import Producer from './producer';
import Inner from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerVal, setInnerVal] = useState('hello');

  return (
    <>
    <Producer open={outerOpen} onOpenChange={setOuterOpen} renderFooter={({ close }) => (<>
        <Inner open={outerOpen} onOpenChange={setOuterOpen} />
        <button onClick={close} data-rozie-s-bd0c3708="">×</button>
      </>)} />
    </>
  );
}
