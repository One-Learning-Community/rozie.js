import type { JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';

interface PresenceCheckFixtureProps {
  asideSlot?: JSX.Element;
}

export default function PresenceCheckFixture(_props: PresenceCheckFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <div class={"presence-check-fixture"} data-rozie-s-313bf282="">
      {<Show when={_props.asideSlot}><aside data-rozie-s-313bf282="">
        {_props.asideSlot}
      </aside></Show>}</div>
    </>
  );
}
