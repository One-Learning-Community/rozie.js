import type { JSX } from 'solid-js';
import { children, splitProps } from 'solid-js';

interface DefaultSlotFixtureProps {
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function DefaultSlotFixture(_props: DefaultSlotFixtureProps): JSX.Element {
  const [local, attrs] = splitProps(_props, ['children']);
  const resolved = children(() => local.children);

  return (
    <>
    <div {...attrs} class={"default-slot-fixture" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...attrs} data-rozie-s-61728cb8="">
      {resolved()}
    </div>
    </>
  );
}
