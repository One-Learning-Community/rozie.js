import type { JSX } from 'solid-js';
import { children, onCleanup, onMount, splitProps } from 'solid-js';
import DummyEngine from 'dummy-engine';

interface SpikeImportElProps {
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
}

export default function SpikeImportEl(_props: SpikeImportElProps): JSX.Element {
  const [local, rest] = splitProps(_props, ['children']);
  const resolved = children(() => local.children);

  onMount(() => {
    const _cleanup = (() => {
    instance = new DummyEngine(__rozieRootRef, {
      animation: 150
    });
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => instance?.destroy());
  });
  let __rozieRootRef: HTMLElement | null = null;

  let instance: any = null;

  return (
    <>
    <div class={"spike-root"} ref={(el) => { __rozieRootRef = el as HTMLElement; }} data-rozie-s-f590f443="">
      {resolved()}
    </div>
    </>
  );
}
