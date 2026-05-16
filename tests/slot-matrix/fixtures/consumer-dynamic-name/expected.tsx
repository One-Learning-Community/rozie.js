import { useState } from 'react';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(props: ConsumerProps): JSX.Element {
  const [slotName, setSlotName] = useState('a');

  return (
    <>
    <Producer slots={{ [slotName]: () => (<>Dynamic fill</>) }} />
    </>
  );
}
