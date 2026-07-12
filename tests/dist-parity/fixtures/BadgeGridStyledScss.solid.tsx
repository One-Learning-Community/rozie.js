import type { JSX } from 'solid-js';
import { mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('BadgeGridStyledScss-44801268', `.badge[data-rozie-s-44801268] {
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
  font-weight: 600;
}
.badge-grid[data-rozie-s-44801268] {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.badge[data-rozie-s-44801268] {
  padding: 2px 8px;
}
.badge--neutral[data-rozie-s-44801268] {
  color: #ffffff;
  background: #6b7280;
}
.badge--success[data-rozie-s-44801268] {
  color: #ffffff;
  background: #16a34a;
}
.badge--warning[data-rozie-s-44801268] {
  color: #ffffff;
  background: #d97706;
}
.badge--danger[data-rozie-s-44801268] {
  color: #ffffff;
  background: #dc2626;
}
.badge-grid--gap-1[data-rozie-s-44801268] {
  gap: 4px;
}
.badge-grid--gap-2[data-rozie-s-44801268] {
  gap: 8px;
}
.badge-grid--gap-3[data-rozie-s-44801268] {
  gap: 12px;
}`);

interface BadgeGridStyledScssProps {
  badges?: any[];
}

export default function BadgeGridStyledScss(_props: BadgeGridStyledScssProps): JSX.Element {
  const _merged = mergeProps({ badges: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['badges']);

  return (
    <>
    <div {...attrs} class={"badge-grid" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-44801268="">
      <Key each={local.badges as readonly any[]} by={(badge) => badge}>{(badge) => <span class={"badge badge--neutral"} data-rozie-s-44801268="">
        {rozieDisplay(badge())}
      </span>}</Key>
    </div>
    </>
  );
}
