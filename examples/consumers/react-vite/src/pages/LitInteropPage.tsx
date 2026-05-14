import { useState, useRef, useEffect } from 'react';
import type { JSX } from 'react';
import '../lit-fixtures/Counter.lit';

/**
 * Phase 06.4 P3 SC5 — React 19 consuming a compiled Lit custom element
 * (<rozie-counter>).
 *
 * Per RESEARCH.md Pattern 11 + CONTEXT.md <specifics>: React 19 added native
 * customElements support. The custom-event handler is bound via the
 * lowercase-dashed `onvalue-change` attribute — NOT the camelCase form that
 * React's synthetic event system would normally rewrite. RESEARCH.md A5 /
 * Pitfall 7: React 19 maps lowercased on-handler attributes to direct
 * property handlers on the custom element, bypassing the synthetic-event
 * system.
 */

// Augment JSX so the compiler accepts <rozie-counter>. With the `react-jsx`
// runtime, intrinsic elements resolve against react's own `JSX` namespace —
// not the global one — so the augmentation must target the `react` module.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'rozie-counter': {
        ref?: React.Ref<HTMLElement>;
        value?: number;
        step?: number;
        min?: number;
        max?: number;
        'onvalue-change'?: (e: Event) => void;
        children?: React.ReactNode;
      };
    }
  }
}

export default function LitInteropPage(): JSX.Element {
  const [val, setVal] = useState<number>(5);
  const counterRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Custom element is mounted; ensure the initial controlled-mode attribute
    // is in sync. React 19 routes onvalue-change to the lowercased property
    // handler, but the initial `value` attr is passed declaratively below.
  }, []);

  return (
    <div>
      <h2>Lit Interop Page</h2>
      <p>
        React 19 consuming compiled Lit <code>&lt;rozie-counter&gt;</code>.
      </p>
      <rozie-counter
        ref={counterRef}
        value={val}
        step={1}
        min={-10}
        max={10}
        onvalue-change={(e: Event) => {
          const detail = (e as CustomEvent).detail as number;
          setVal(detail);
        }}
      ></rozie-counter>
      <p>
        Parent-tracked value:{' '}
        <span data-testid="parent-value">{val}</span>
      </p>
    </div>
  );
}
