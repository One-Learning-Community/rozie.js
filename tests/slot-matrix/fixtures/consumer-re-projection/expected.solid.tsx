import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import Wrapper from './wrapper';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <Wrapper data-rozie-s-bd0c3708="" titleSlot={() => (<>Hello from consumer</>)} />
    </>
  );
}
