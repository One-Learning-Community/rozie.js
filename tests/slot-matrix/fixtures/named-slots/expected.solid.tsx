import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NamedSlotsFixtureProps extends Omit<import('solid-js').ComponentProps<'div'>, 'headerSlot' | 'footerSlot' | 'slots' | 'children' | 'innerHTML' | 'innerText' | 'textContent' | 'ref'> {
  headerSlot?: JSX.Element;
  footerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function NamedSlotsFixture(_props: NamedSlotsFixtureProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <div {...attrs} class={"named-slots-fixture" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-a30182bc="">
      <header data-rozie-s-a30182bc="">
        {(_props.headerSlot ?? _props.slots?.['header']?.({}))}
      </header>
      <footer data-rozie-s-a30182bc="">
        {(_props.footerSlot ?? _props.slots?.['footer']?.({}))}
      </footer>
    </div>
    </>
  );
}
