import type { JSX } from 'solid-js';
import { mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle } from '@rozie/runtime-solid';

__rozieInjectStyle('SolidRefObjectPropNull-fa7fb7c9', `.solid-ref-objectprop-null[data-rozie-s-fa7fb7c9] { display: block; }`);

interface SolidRefObjectPropNullProps {
  options?: Record<string, any>;
}

export default function SolidRefObjectPropNull(_props: SolidRefObjectPropNullProps): JSX.Element {
  const _merged = mergeProps({ options: (() => ({}))() as Record<string, any> }, _props);
  const [local, attrs] = splitProps(_merged, ['options']);

  onMount(() => {
    const _cleanup = (() => {
    engine = useEngine(containerRef!, {
      plugins: local.options.plugins ?? []
    });
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => engine?.destroy());
  });
  let containerRef: HTMLElement | null = null;

  // Pattern D (260712-a09) — a self-contained stand-in for a real engine
  // constructor (SortableJS/CodeMirror-shaped): a non-null `HTMLElement`
  // param. Mirrors `useSortableJS(el: HTMLElement, opts: ...)`'s real-world
  // signature without depending on an external package's types.
  function useEngine(el: HTMLElement, opts: Record<string, unknown>) {
    return {
      destroy() {
        void el;
        void opts;
      }
    };
  }

  // Pattern F proof: member access on the Object-typed prop's default-widened
  // type. Before the fix this is TS2339 on the `{}` union alternative.
  function pluginNames(): string[] {
    return Object.keys(local.options.plugins ?? {});
  }
  let engine: {
    destroy(): void;
  } | undefined;

  // Pattern D proof: `$refs.container` passed as a DIRECT call argument to a
  // non-null-typed engine constructor inside $onMount. Before the fix this is
  // TS2345 (`HTMLElement | null` not assignable to `HTMLElement`).

  return (
    <>
    <div ref={(el) => { containerRef = el as HTMLElement; }} {...attrs} class={"solid-ref-objectprop-null" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-fa7fb7c9="">
      <span data-rozie-s-fa7fb7c9="">{pluginNames().length}</span>
    </div>
    </>
  );
}
