import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NamedSlotsFixtureProps {
  headerSlot?: JSX.Element;
  footerSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function NamedSlotsFixture(_props: NamedSlotsFixtureProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  return (
    <>
    <div class={"named-slots-fixture"} {...attrs} data-rozie-s-a30182bc="">
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
