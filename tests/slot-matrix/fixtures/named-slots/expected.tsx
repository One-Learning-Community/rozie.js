import type { ReactNode } from 'react';

interface NamedSlotsFixtureProps {
  renderHeader?: () => ReactNode;
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function NamedSlotsFixture(props: NamedSlotsFixtureProps): JSX.Element {
  const attrs = props as Record<string, unknown>;

  return (
    <>
    <div className={"named-slots-fixture"} {...attrs} data-rozie-s-a30182bc="">
      <header data-rozie-s-a30182bc="">
        {(props.renderHeader ?? props.slots?.['header'])?.()}
      </header>
      <footer data-rozie-s-a30182bc="">
        {(props.renderFooter ?? props.slots?.['footer'])?.()}
      </footer>
    </div>
    </>
  );
}
