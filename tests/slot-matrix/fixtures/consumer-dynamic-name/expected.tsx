import { useState } from 'react';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [slotName, setSlotName] = useState('a');

  return (
    <>
    <Producer data-rozie-s-bd0c3708="" slots={{ [slotName]: () => (<>Dynamic fill</>) }} />
    </>
  );
}
