import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

interface NamedSlotsFixtureProps {
  headerSlot?: JSX.Element;
  footerSlot?: JSX.Element;
}

export default function NamedSlotsFixture(_props: NamedSlotsFixtureProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  return (
    <>
    <div class={"named-slots-fixture"} data-rozie-s-a30182bc="">
      <header data-rozie-s-a30182bc="">
        {_props.headerSlot}
      </header>
      <footer data-rozie-s-a30182bc="">
        {_props.footerSlot}
      </footer>
    </div>
    </>
  );
}
