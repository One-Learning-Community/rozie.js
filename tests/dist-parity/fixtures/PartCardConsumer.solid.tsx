import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';
import PartCard from './PartCard';

__rozieInjectStyle('PartCardConsumer-7f4fb92a', `.part-card-consumer[data-rozie-s-7f4fb92a] {
  display: inline-flex;
  padding: 0.5rem;
}`);

interface PartCardConsumerProps {}

export default function PartCardConsumer(_props: PartCardConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <div {...attrs} class={"part-card-consumer" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-7f4fb92a="">
      <PartCard title={'Hello'} data-rozie-s-7f4fb92a="">
        Cross-shadow styled body content.
      </PartCard>
    </div>
    </>
  );
}
