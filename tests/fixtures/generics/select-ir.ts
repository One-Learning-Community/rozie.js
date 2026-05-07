/**
 * select-ir — manual IR construction for the Select<T> generic fixture
 * (RESEARCH OQ2 RESOLVED).
 *
 * The Phase 1 .rozie parser does NOT support `<rozie name="Select"
 * generic="T">` syntax in v1, so a generic-component IR cannot be
 * produced via parse() + lowerToIR() yet. This helper constructs the
 * IRComponent shape a v2 parser would emit, so the type-emission
 * machinery (`emitReactTypes`, `emitVue`) can be exercised against the
 * canonical Select<T> shape.
 *
 * Consumers:
 *   - packages/targets/react/src/__tests__/emitTypes.test.ts   (Plan 06-02 Task 2)
 *   - packages/targets/vue/src/__tests__/generics.test.ts      (Plan 06-02 Task 3)
 *   - examples/consumers/scripts/refresh-consumer-fixtures.mjs (Plan 06-05 — vue-ts bootstrap)
 */
import type { IRComponent } from '../../../packages/core/src/ir/types.js';

const ZERO_LOC = { start: 0, end: 0 };

/**
 * Build a `Select<T>` IRComponent suitable for generic-preservation tests.
 *
 * Shape:
 *   - `items`     — non-model prop, typed `T[]` at the v1 IR level via
 *     `{ kind: 'identifier', name: 'Array' }` (which renders to `unknown[]`
 *     in the .d.ts; v2 IR may extend to render as `T[]`).
 *   - `selected`  — model:true prop, typed `T` via `{ kind: 'identifier',
 *     name: 'T' }` so renderPropType passes the identifier through verbatim.
 *
 * No state, no slots, no template — the goal is a minimal generic-shaped IR
 * for the type-emission code paths.
 */
export function makeSelectIR(): IRComponent {
  return {
    type: 'IRComponent',
    name: 'Select',
    props: [
      {
        type: 'PropDecl',
        name: 'items',
        typeAnnotation: { kind: 'identifier', name: 'Array' },
        defaultValue: null,
        isModel: false,
        sourceLoc: ZERO_LOC,
      },
      {
        type: 'PropDecl',
        name: 'selected',
        typeAnnotation: { kind: 'identifier', name: 'T' },
        defaultValue: null,
        isModel: true,
        sourceLoc: ZERO_LOC,
      },
    ],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    listeners: [],
    setupBody: {
      type: 'SetupBody',
      // An empty Babel File is enough for v1 — emitters that touch the
      // Program walk it defensively.
      scriptProgram: {
        type: 'File',
        program: {
          type: 'Program',
          body: [],
          directives: [],
          sourceType: 'module',
        },
      } as never,
      annotations: [],
    },
    template: null,
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      sourceLoc: ZERO_LOC,
    },
    sourceLoc: ZERO_LOC,
  };
}
