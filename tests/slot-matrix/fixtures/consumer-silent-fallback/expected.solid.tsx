import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import Producer from './producer';

interface ConsumerProps {}

export default function Consumer(_props: ConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <Producer title={'Hello'} data-rozie-s-bd0c3708="">Body text</Producer>
    </>
  );
}
