import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import Wrapper from './wrapper';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <Wrapper titleSlot={() => (<>Hello from consumer</>)} />
    </>
  );
}
