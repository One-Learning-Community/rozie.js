import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import DynamicSlots from './DynamicSlots';

interface DynamicSlotsConsumerProps {}

export default function DynamicSlotsConsumer(_props: DynamicSlotsConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [dynamicFillKey, setDynamicFillKey] = createSignal('freeform');

  return (
    <>
    <div {...attrs} class={"dynamic-slots-consumer" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-e638f506="">
      <DynamicSlots columns={[{ key: 'status' }, { key: 'score' }]} row={{ status: 'Active', score: 42 }} total={7} data-rozie-s-e638f506=""    headerCellSlot={({ title }) => (<>
          <h2 data-rozie-s-e638f506="">{rozieDisplay(title)}</h2>
        </>)} slots={{ 'cell-status': ({ row, value }) => (<>
          <span class={"status"} data-rozie-s-e638f506="">{rozieDisplay(value)}</span>
        </>), 'cell-score': ({ row, value }) => (<>
          <span class={"score"} data-rozie-s-e638f506="">{rozieDisplay(value)}</span>
        </>), 'cell-total': ({ value }) => (<>
          <strong data-rozie-s-e638f506="">{rozieDisplay(value)}</strong>
        </>), [dynamicFillKey()]: ({ label }) => (<>
          <em data-rozie-s-e638f506="">{rozieDisplay(label)}</em>
        </>) }} />
    </div>
    </>
  );
}
