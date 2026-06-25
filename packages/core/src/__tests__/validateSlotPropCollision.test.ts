// Phase 28 (slot/prop same-name collision class) — core
// `validateSlotPropCollision` test.
//
// A `<slot name="X">` whose `X` equals a declared `<props>` key is a HARD
// compile ERROR (ROZ127 SLOT_PROP_NAME_COLLISION). The collision is
// unsupportable uniformly across targets because Svelte 5 unifies snippets and
// props into ONE `$props()` namespace — the regenerated Svelte leaf's `Props`
// would declare `X` twice (the prop type AND a Snippet), both sourcing from the
// same key, poisoning the slot derivation. The other 5 targets keep prop and
// slot in distinct consumer namespaces and are immune — a silent 1-of-6
// divergence, which this validator turns into a loud error.
//
// The validator runs in `lowerToIR` so the SAME chokepoint covers BOTH
// `compile()` AND the `@rozie/unplugin` `parse → lowerToIR → emit{Target}`
// pipeline. This file proves:
//   (a) a synthetic IR with a prop + slot sharing a name → exactly one ROZ127
//       error carrying BOTH code-frames (primary at the slot, related[] at the
//       prop);
//   (b) a non-colliding synthetic IR → zero diagnostics;
//   (c) the validator fires through `compile()` (the public-API path); and
//   (d) the validator fires through `parse() → lowerToIR()` (the @rozie/unplugin
//       chokepoint), proving a colliding `.rozie` fails in a Vite build too.
//
// (a)/(b) construct the IR DIRECTLY (no colliding `.rozie` fixture is added to
// the repo — that would break other gates); (c)/(d) drive an inline `.rozie`
// source string (not a repo fixture) to prove the end-to-end wiring.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { validateSlotPropCollision } from '../ir/validateSlotPropCollision.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent, PropDecl, SlotDecl } from '../ir/types.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const SLOT_PROP_NAME_COLLISION = RozieErrorCode.SLOT_PROP_NAME_COLLISION; // ROZ127

/** Minimal `PropDecl` carrying a name + a recognisable sourceLoc. */
function prop(name: string, start: number): PropDecl {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: { kind: 'literal', value: 'boolean' },
    defaultValue: null,
    isModel: false,
    required: false,
    sourceLoc: { start, end: start + name.length },
  };
}

/** Minimal portal `SlotDecl` carrying a name + a recognisable sourceLoc. */
function slot(name: string, start: number): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'always',
    nestedSlots: [],
    isPortal: true,
    portalParamNames: ['arg'],
    sourceLoc: { start, end: start + name.length },
  };
}

/**
 * Build a stub `IRComponent` exposing only the two regions the validator reads
 * (`props`, `slots`). The validator never touches any other field, so a narrow
 * cast keeps the fixture honest without faking a whole component.
 */
function stubIR(props: PropDecl[], slots: SlotDecl[]): IRComponent {
  return { props, slots } as unknown as IRComponent;
}

describe('validateSlotPropCollision [Phase 28] — direct IR', () => {
  it('(a) a prop + slot sharing a name → exactly one ROZ127 error with both code-frames', () => {
    const collidingProp = prop('nowIndicator', 100);
    const collidingSlot = slot('nowIndicator', 500);
    const ir = stubIR(
      [prop('events', 10), collidingProp, prop('height', 200)],
      [slot('event', 400), collidingSlot, slot('moreLink', 600)],
    );

    const diagnostics: Diagnostic[] = [];
    validateSlotPropCollision(ir, diagnostics);

    const collisions = diagnostics.filter(
      (d) => d.code === SLOT_PROP_NAME_COLLISION,
    );
    expect(collisions).toHaveLength(1);

    const diag = collisions[0]!;
    expect(diag.severity).toBe('error');
    // The message names the colliding identifier and the Svelte-5 reason.
    expect(diag.message).toContain('nowIndicator');
    expect(diag.message).toContain('$props');
    // Primary frame anchors at the SLOT declaration.
    expect(diag.loc).toEqual(collidingSlot.sourceLoc);
    // Secondary frame (related[]) anchors at the colliding PROP declaration.
    expect(diag.related).toBeDefined();
    expect(diag.related).toHaveLength(1);
    expect(diag.related![0]!.loc).toEqual(collidingProp.sourceLoc);
    expect(diag.related![0]!.message).toContain('nowIndicator');
    // Remediation hint nudges toward renaming the slot.
    expect(diag.hint).toBeDefined();
    expect(diag.hint).toContain('Content');
  });

  it('(b) a non-colliding component → zero diagnostics', () => {
    // `nowIndicator` (prop) vs `nowIndicatorContent` (slot) — distinct names,
    // the exact post-rename FullCalendar shape.
    const ir = stubIR(
      [prop('events', 10), prop('nowIndicator', 100), prop('height', 200)],
      [
        slot('event', 400),
        slot('nowIndicatorContent', 500),
        slot('moreLink', 600),
      ],
    );

    const diagnostics: Diagnostic[] = [];
    validateSlotPropCollision(ir, diagnostics);

    expect(diagnostics).toHaveLength(0);
  });

  it('(b′) case-sensitivity: `Open` slot does NOT collide with `open` prop', () => {
    const ir = stubIR([prop('open', 100)], [slot('Open', 500)]);
    const diagnostics: Diagnostic[] = [];
    validateSlotPropCollision(ir, diagnostics);
    expect(diagnostics).toHaveLength(0);
  });

  // Phase 61 Plan 09 — DOM-footgun check (3) is gated to SCOPED/PORTAL slots.
  // A PLAIN named slot named after a DOM member (`title`) does NOT mint a bare
  // Lit `@property` accessor (only `_hasSlotTitle` / `_slotTitleElements` +
  // a native `<slot name="title">`), so it must NOT fire ROZ127. This is the
  // slot-matrix `consumer-re-projection` wrapper false-positive root cause.
  it('(b″) a PLAIN named slot `title` (no portal, no params) does NOT fire ROZ127', () => {
    const plainTitle: SlotDecl = {
      type: 'SlotDecl',
      name: 'title',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      isPortal: false,
      sourceLoc: { start: 500, end: 505 },
    } as unknown as SlotDecl;
    const ir = stubIR([], [plainTitle]);
    const diagnostics: Diagnostic[] = [];
    validateSlotPropCollision(ir, diagnostics);
    expect(diagnostics).toHaveLength(0);
  });

  // The TRUE-POSITIVE side: a SCOPED slot `title` (params present) DOES mint a
  // bare `@property title` accessor on Lit → genuine TS2416 → ROZ127 fires.
  it('(b‴) a SCOPED slot `title` (params present) DOES fire ROZ127 (bare @property accessor)', () => {
    const scopedTitle: SlotDecl = {
      type: 'SlotDecl',
      name: 'title',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'row', valueExpression: null } as unknown,
      ],
      presence: 'always',
      nestedSlots: [],
      isPortal: false,
      sourceLoc: { start: 500, end: 505 },
    } as unknown as SlotDecl;
    const ir = stubIR([], [scopedTitle]);
    const diagnostics: Diagnostic[] = [];
    validateSlotPropCollision(ir, diagnostics);
    const collisions = diagnostics.filter(
      (d) => d.code === SLOT_PROP_NAME_COLLISION,
    );
    expect(collisions).toHaveLength(1);
    expect(collisions[0]!.message).toContain('title');
  });
});

// A colliding inline `.rozie` source — a prop `panel` AND a portal-slot
// `panel`. Used to prove the validator fires end-to-end through BOTH the
// compile() path and the @rozie/unplugin (parse → lowerToIR) chokepoint.
const COLLIDING_SOURCE = `<rozie name="SlotPropCollision">

<props>
{
  panel: { type: Boolean, default: false },
}
</props>

<script>
$onMount(() => {
  if ($slots.panel) { /* portal-invoked from script */ }
})
</script>

<template>
<div class="host" />
<slot name="panel" portal :params="['arg']" />
</template>
</rozie>
`;

describe('validateSlotPropCollision [Phase 28] — entrypoint wiring', () => {
  it('(c) fires through compile() (public-API path)', () => {
    const { diagnostics } = compile(COLLIDING_SOURCE, {
      target: 'vue',
      filename: 'SlotPropCollision.rozie',
      types: false,
      sourceMap: false,
    });
    const err = diagnostics.find(
      (d) => d.code === SLOT_PROP_NAME_COLLISION && d.severity === 'error',
    );
    expect(
      err,
      'expected a ROZ127 error through compile()',
    ).toBeDefined();
  });

  it('(d) fires through parse() → lowerToIR() (the @rozie/unplugin chokepoint)', () => {
    const { ast } = parse(COLLIDING_SOURCE, {
      filename: 'SlotPropCollision.rozie',
    });
    expect(ast, 'parse() should produce an AST for a well-formed source').not.toBeNull();
    const { diagnostics } = lowerToIR(ast!, {
      modifierRegistry: createDefaultRegistry(),
    });
    const err = diagnostics.find(
      (d) => d.code === SLOT_PROP_NAME_COLLISION && d.severity === 'error',
    );
    expect(
      err,
      'expected a ROZ127 error through the unplugin lowerToIR chokepoint',
    ).toBeDefined();
  });

  it('the post-rename FullCalendar shape (prop nowIndicator + slot nowIndicatorContent) compiles ROZ127-free', () => {
    const source = `<rozie name="NoCollision">

<props>
{
  nowIndicator: { type: Boolean, default: false },
}
</props>

<script>
$onMount(() => {
  if ($slots.nowIndicatorContent) { /* portal-invoked from script */ }
})
</script>

<template>
<div class="host" />
<slot name="nowIndicatorContent" portal :params="['arg']" />
</template>
</rozie>
`;
    const { diagnostics } = compile(source, {
      target: 'vue',
      filename: 'NoCollision.rozie',
      types: false,
      sourceMap: false,
    });
    const collisions = diagnostics.filter(
      (d) => d.code === SLOT_PROP_NAME_COLLISION,
    );
    expect(collisions).toHaveLength(0);
  });
});
