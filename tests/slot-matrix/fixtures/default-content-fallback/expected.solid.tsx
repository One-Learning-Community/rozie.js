import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface DefaultContentFallbackFixtureProps {
  statusSlot?: JSX.Element;
}

export default function DefaultContentFallbackFixture(_props: DefaultContentFallbackFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <div class={"default-content-fallback-fixture"}>
      {_props.statusSlot ?? <span class={"fallback"}>No status provided.</span>}
    </div>
    </>
  );
}
