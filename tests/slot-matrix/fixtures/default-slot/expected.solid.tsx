import type { JSX } from 'solid-js';
import { children, splitProps } from 'solid-js';

interface DefaultSlotFixtureProps {
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
}

export default function DefaultSlotFixture(_props: DefaultSlotFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['children']);
  const resolved = children(() => local.children);

  return (
    <>
    <div class={"default-slot-fixture"} data-rozie-s-61728cb8="">
      {resolved()}
    </div>
    </>
  );
}
