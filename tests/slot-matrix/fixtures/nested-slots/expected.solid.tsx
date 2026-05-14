import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NestedSlotsFixtureProps {
  wrapperSlot?: JSX.Element;
}

export default function NestedSlotsFixture(_props: NestedSlotsFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <div class={"nested-slots-fixture"}>
      {_props.wrapperSlot ?? <div class={"wrapper-fallback"}>
          {_props.innerSlot}
        </div>}
    </div>
    </>
  );
}
