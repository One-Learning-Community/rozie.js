import { useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import DynamicSlots from './DynamicSlots';

interface DynamicSlotsConsumerProps {}

export default function DynamicSlotsConsumer(props: DynamicSlotsConsumerProps): JSX.Element {
  const attrs = props as Record<string, unknown>;
  const [dynamicFillKey, setDynamicFillKey] = useState('freeform');

  return (
    <>
    <div {...attrs} className={clsx("dynamic-slots-consumer", (attrs.className as string | undefined))} data-rozie-s-e638f506="">
      <DynamicSlots columns={[{ key: 'status' }, { key: 'score' }]} row={{ status: 'Active', score: 42 }} total={7} data-rozie-s-e638f506=""    renderHeaderCell={({ title }) => (<>
          <h2 data-rozie-s-e638f506="">{rozieDisplay(title)}</h2>
        </>)} slots={{ 'cell-status': ({ row, value }) => (<>
          <span className={"status"} data-rozie-s-e638f506="">{rozieDisplay(value)}</span>
        </>), 'cell-score': ({ row, value }) => (<>
          <span className={"score"} data-rozie-s-e638f506="">{rozieDisplay(value)}</span>
        </>), 'cell-total': ({ value }) => (<>
          <strong data-rozie-s-e638f506="">{rozieDisplay(value)}</strong>
        </>), [dynamicFillKey]: ({ label }) => (<>
          <em data-rozie-s-e638f506="">{rozieDisplay(label)}</em>
        </>) }} />
    </div>
    </>
  );
}
