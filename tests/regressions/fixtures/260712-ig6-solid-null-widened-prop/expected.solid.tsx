import type { JSX } from 'solid-js';
import { mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, rozieDisplay } from '@rozie/runtime-solid';

// Self-contained stand-in for a real 3rd-party engine (SortableJS-shaped):
// its options object types `handle` as `string | undefined`, NEVER
// `string | null` — mirrors sortablejs's real-world `Options` type.
interface EngineOptions {
  handle?: string;
}

__rozieInjectStyle('SolidNullWidenedPropObjectLiteral-a4efe4c5', `.solid-null-widened-prop[data-rozie-s-a4efe4c5] { display: block; }`);

interface SolidNullWidenedPropObjectLiteralProps {
  handle?: (string) | null;
  label?: (string) | null;
}

export default function SolidNullWidenedPropObjectLiteral(_props: SolidNullWidenedPropObjectLiteralProps): JSX.Element {
  const _merged = mergeProps({ handle: null, label: null }, _props);
  const [local, attrs] = splitProps(_merged, ['handle', 'label']);

  onMount(() => {
    const _cleanup = (() => {
    engine = useEngine(containerRef!, {
      handle: local.handle ?? undefined
    });
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => engine?.destroy());
  });
  let containerRef: HTMLElement | null = null;

  function useEngine(el: HTMLElement, opts: EngineOptions) {
    return {
      destroy() {
        void el;
        void opts;
      }
    };
  }

  // Byte-identity control proof: read into a local, NOT spliced into a
  // 3rd-party object-literal call argument. Must stay a bare `local.label`
  // read (no coercion).
  const labelLocal = local.label;
  let engine: {
    destroy(): void;
  } | undefined;

  // Task B proof: `$props.handle` (null-widened) spliced into an object-literal
  // property passed to a 3rd-party-style call inside $onMount. Before the fix
  // this is TS2345/TS2322 (`string | null` not assignable to `string | undefined`).

  return (
    <>
    <div ref={(el) => { containerRef = el as HTMLElement; }} {...attrs} class={"solid-null-widened-prop" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-a4efe4c5="">
      <span data-rozie-s-a4efe4c5="">{rozieDisplay(labelLocal)}</span>
    </div>
    </>
  );
}
