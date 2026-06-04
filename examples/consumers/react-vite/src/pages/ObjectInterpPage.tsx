import type { JSX } from 'react';
import ObjectInterp from '../ObjectInterp.rozie';

/**
 * ObjectInterpPage — Phase 26 (D-08/D-09) object-interpolation runtime probe.
 *
 * Mounts the canonical ObjectInterp fixture, which interpolates an untyped
 * <data> object ({ a: 1, b: [2, 3] }) in a text node, a `:data-x` attribute
 * binding, and a class interpolation. Before Phase 26 the React leg crashed
 * with "Objects are not valid as a React child" the instant a non-primitive
 * reached an interpolation site; the annotateDisplayWrap gate now wraps each
 * position in rozieDisplay, so the object renders as 2-space pretty-printed
 * JSON text instead.
 *
 * The object-interpolation.spec.ts e2e navigates here and asserts (a) NO React
 * error overlay / "Objects are not valid as a React child" console error and
 * (b) the interpolated object renders as the expected JSON. This is SPEC-1's
 * no-crash acceptance arm (D-09); the byte-exact cross-target JSON parity is
 * proven separately by the dist-parity text gates.
 */
export default function ObjectInterpPage(): JSX.Element {
  return (
    <div>
      <h2>ObjectInterp</h2>
      <ObjectInterp />
    </div>
  );
}
