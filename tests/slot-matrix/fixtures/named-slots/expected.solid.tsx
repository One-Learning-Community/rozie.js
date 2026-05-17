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
    <div class={"named-slots-fixture"} data-rozie-s-e2d83b2f="">
      <header data-rozie-s-e2d83b2f="">
        {_props.headerSlot}
      </header>
      <footer data-rozie-s-e2d83b2f="">
        {_props.footerSlot}
      </footer>
    </div>
    </>
  );
}
