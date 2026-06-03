import { clsx } from '@rozie/runtime-react';
import './PartCardConsumer.css';
import PartCard from './PartCard';

interface PartCardConsumerProps {}

export default function PartCardConsumer(props: PartCardConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div {...attrs} className={clsx("part-card-consumer", (attrs.className as string | undefined))} data-rozie-s-7f4fb92a="">
      <PartCard title={'Hello'} data-rozie-s-7f4fb92a="" children={<>
        Cross-shadow styled body content.
      </>} />
    </div>
    </>
  );
}
