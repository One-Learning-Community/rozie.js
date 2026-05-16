import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NestedSlotsFixtureProps {
  wrapperSlot?: JSX.Element;
  innerSlot?: JSX.Element;
}

export default function NestedSlotsFixture(_props: NestedSlotsFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <div class={"nested-slots-fixture"} data-rozie-s-4d5488e4="">
      {_props.wrapperSlot ?? <div class={"wrapper-fallback"} data-rozie-s-4d5488e4="">
          {_props.innerSlot}
        </div>}
    </div>
    </>
  );
}
