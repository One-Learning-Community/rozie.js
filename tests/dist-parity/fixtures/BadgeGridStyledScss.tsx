import { useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import './BadgeGridStyledScss.css';

interface BadgeGridStyledScssProps {
  badges?: any[];
}

export default function BadgeGridStyledScss(_props: BadgeGridStyledScssProps): JSX.Element {
  const __defaultBadges = useState(() => (() => [])())[0];
  const props: Omit<BadgeGridStyledScssProps, 'badges'> & { badges: any[] } = {
    ..._props,
    badges: _props.badges ?? __defaultBadges,
  };
  const attrs: Record<string, unknown> = (() => {
    const { badges, ...rest } = _props as BadgeGridStyledScssProps & Record<string, unknown>;
    void badges;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx("badge-grid", (attrs.className as string | undefined))} data-rozie-s-44801268="">
      {props.badges.map((badge) => <span key={badge} className={"badge badge--neutral"} data-rozie-s-44801268="">
        {rozieDisplay(badge)}
      </span>)}
    </div>
    </>
  );
}
