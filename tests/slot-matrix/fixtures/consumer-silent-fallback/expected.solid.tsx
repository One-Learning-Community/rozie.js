import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <Producer title={'Hello'}>Body text</Producer>
    </>
  );
}
