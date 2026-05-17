import type { ReactNode } from 'react';

interface NamedSlotsFixtureProps {
  renderHeader?: ReactNode;
  renderFooter?: ReactNode;
}

export default function NamedSlotsFixture(props: NamedSlotsFixtureProps): JSX.Element {
  return (
    <>
    <div className={"named-slots-fixture"} data-rozie-s-e2d83b2f="">
      <header data-rozie-s-e2d83b2f="">
        {props.renderHeader}
      </header>
      <footer data-rozie-s-e2d83b2f="">
        {props.renderFooter}
      </footer>
    </div>
    </>
  );
}
