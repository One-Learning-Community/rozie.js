import type { ReactNode } from 'react';

interface NamedSlotsFixtureProps {
  renderHeader?: ReactNode;
  renderFooter?: ReactNode;
}

export default function NamedSlotsFixture(props: NamedSlotsFixtureProps): JSX.Element {
  return (
    <>
    <div className={"named-slots-fixture"} data-rozie-s-a30182bc="">
      <header data-rozie-s-a30182bc="">
        {props.renderHeader}
      </header>
      <footer data-rozie-s-a30182bc="">
        {props.renderFooter}
      </footer>
    </div>
    </>
  );
}
