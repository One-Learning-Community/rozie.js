import type { JSX } from 'solid-js';
import { Show, createSignal, onMount, splitProps } from 'solid-js';

interface ClassSelectorProbeProps {}

export default function ClassSelectorProbe(_props: ClassSelectorProbeProps): JSX.Element {
  const [local, rest] = splitProps(_props, []);

  const [ready, setReady] = createSignal(false);
  onMount(() => {
    setReady(true);
  });

  // script-position class-selector helper call — exercises the rewriteScript.ts
  // hook. Lowers per-target: ".grip" literal (Vue/Svelte/Solid/Angular/Lit) or
  // "." + styles.grip (React).
  const gripSelector = ".grip";

  return (
    <>
    <style>{`.panel[data-rozie-s-899140be] {
      display: block;
      padding: 0.5rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .grip[data-rozie-s-899140be] {
      cursor: grab;
      user-select: none;
      color: rgba(0, 0, 0, 0.35);
    }`}</style>
    <>
    <div class={"panel"} data-handle={'.panel'} data-grip={gripSelector} data-rozie-s-899140be="">
      <span class={"grip"} aria-hidden="true" data-rozie-s-899140be="">⋮⋮</span>
      {<Show when={ready()}><span data-rozie-s-899140be="">ready</span></Show>}</div>
    </>
    </>
  );
}
