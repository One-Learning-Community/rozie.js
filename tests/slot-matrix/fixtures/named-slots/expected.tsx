import type { ReactNode } from 'react';

interface NamedSlotsFixtureProps {
  renderHeader?: ReactNode;
  renderFooter?: ReactNode;
}

export default function NamedSlotsFixture(props: NamedSlotsFixtureProps): JSX.Element {
  return (
    <>
    <div className={"named-slots-fixture"}>
      <header>
        {props.renderHeader}
      </header>
      <footer>
        {props.renderFooter}
      </footer>
    </div>
    </>
  );
}
