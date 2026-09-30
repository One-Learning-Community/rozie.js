import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';
import DynamicSlots from './DynamicSlots';

interface DynamicSlotsConsumerProps extends Omit<import('solid-js').ComponentProps<'div'>, 'children' | 'innerHTML' | 'innerText' | 'textContent' | 'ref'> {}

export default function DynamicSlotsConsumer(_props: DynamicSlotsConsumerProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [dynamicFillKey, setDynamicFillKey] = createSignal('freeform');

  return (
    <>
    <div {...attrs} class={"dynamic-slots-consumer" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-e638f506="">
      <DynamicSlots columns={[{ key: 'status' }, { key: 'score' }]} row={{ status: 'Active', score: 42 }} total={7} data-rozie-s-e638f506=""    headerCellSlot={(_rozieSlot) => (<>
          <h2 data-rozie-s-e638f506="">{rozieDisplay(_rozieSlot.title)}</h2>
        </>)} slots={{ 'cell-status': (_rozieSlot) => (<>
          <span class={"status"} data-rozie-s-e638f506="">{rozieDisplay(_rozieSlot.value)}</span>
        </>), 'cell-score': (_rozieSlot) => (<>
          <span class={"score"} data-rozie-s-e638f506="">{rozieDisplay(_rozieSlot.value)}</span>
        </>), 'cell-total': (_rozieSlot) => (<>
          <strong data-rozie-s-e638f506="">{rozieDisplay(_rozieSlot.value)}</strong>
        </>), [dynamicFillKey()]: (_rozieSlot) => (<>
          <em data-rozie-s-e638f506="">{rozieDisplay(_rozieSlot.label)}</em>
        </>) }} />
    </div>
    </>
  );
}
