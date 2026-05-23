import type { JSX } from 'solid-js';
import { Show, splitProps } from 'solid-js';

interface PresenceCheckFixtureProps {
  asideSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function PresenceCheckFixture(_props: PresenceCheckFixtureProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <div {...attrs} class={"presence-check-fixture" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-313bf282="">
      {<Show when={(_props.asideSlot ?? _props.slots?.['aside'])}><aside data-rozie-s-313bf282="">
        {(_props.asideSlot ?? _props.slots?.['aside']?.({}))}
      </aside></Show>}</div>
    </>
  );
}
