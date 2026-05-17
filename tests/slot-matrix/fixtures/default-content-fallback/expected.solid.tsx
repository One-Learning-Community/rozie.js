import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface DefaultContentFallbackFixtureProps {
  statusSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function DefaultContentFallbackFixture(_props: DefaultContentFallbackFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <div class={"default-content-fallback-fixture"} data-rozie-s-62104151="">
      {(_props.statusSlot ?? _props.slots?.['status']) ?? <span class={"fallback"} data-rozie-s-62104151="">No status provided.</span>}
    </div>
    </>
  );
}
