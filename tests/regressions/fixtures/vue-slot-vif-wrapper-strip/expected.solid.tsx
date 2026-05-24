import type { JSX } from 'solid-js';
import { Show, children, mergeProps, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('PresenceSlotFallback-224e77e7', `.panel[data-rozie-s-224e77e7] { border: 1px solid rgba(0, 0, 0, 0.1); }`);

interface PresenceSlotFallbackProps {
  title?: string;
  headerSlot?: JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function PresenceSlotFallback(_props: PresenceSlotFallbackProps): JSX.Element {
  const _merged = mergeProps({ title: '' }, _props);
  const [local, attrs] = splitProps(_merged, ['title', 'children']);
  const resolved = children(() => local.children);

  return (
    <>
    <section {...attrs} class={"panel" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-224e77e7="">
      {<Show when={(_props.headerSlot ?? _props.slots?.['header']) || local.title}><header data-rozie-s-224e77e7="">
        
        {(_props.headerSlot ?? _props.slots?.['header']?.({})) ?? local.title}
      </header></Show>}<div class={"body"} data-rozie-s-224e77e7="">
        {resolved()}
      </div>
    </section>
    </>
  );
}
