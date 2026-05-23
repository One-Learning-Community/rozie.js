import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NestedSlotsFixtureProps {
  wrapperSlot?: JSX.Element;
  innerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function NestedSlotsFixture(_props: NestedSlotsFixtureProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <div {...attrs} class={"nested-slots-fixture" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-4d5488e4="">
      {(_props.wrapperSlot ?? _props.slots?.['wrapper']?.({})) ?? <div class={"wrapper-fallback"} data-rozie-s-4d5488e4="">
          {(_props.innerSlot ?? _props.slots?.['inner']?.({}))}
        </div>}
    </div>
    </>
  );
}
