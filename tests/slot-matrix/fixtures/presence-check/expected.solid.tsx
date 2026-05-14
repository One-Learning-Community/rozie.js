import type { JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';

interface PresenceCheckFixtureProps {
  asideSlot?: JSX.Element;
}

export default function PresenceCheckFixture(_props: PresenceCheckFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <div class={"presence-check-fixture"}>
      {<Show when={_props.asideSlot}><aside>
        {_props.asideSlot}
      </aside></Show>}</div>
    </>
  );
}
