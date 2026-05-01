// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-05 fills these in.
//
// IR-02 / D-18 SlotDecl shape lock. The most expensive decision in the
// project to retrofit; the snapshot test plus a type-level test catch
// drift at both the shape and the field-types levels.
import { describe, it } from 'vitest';

describe('SlotDecl shape lock — Plan 02-05 (D-18)', () => {
  it.todo('SlotDecl shape lock: fixtures/ir/SlotDecl-shape.snap matches a hand-authored canonical SlotDecl literal — D-18 lock');
  it.todo('Type-level: expectTypeOf<SlotDecl>().toEqualTypeOf<{ type: "SlotDecl"; name: string; defaultContent: TemplateNode | null; params: ParamDecl[]; paramTypes?: TSType[]; presence: "always" | "conditional"; nestedSlots: SlotDecl[]; sourceLoc: SourceLoc }>()');
  it.todo('TodoList.rozie produces SlotDecl[] of length 3 (header, default, empty) — header.presence === "always" (no $slots.header guard wrapping <slot name="header">)');
  it.todo('Modal.rozie produces SlotDecl[] of length 3 with presence: header → "conditional" (sits inside <header r-if="$slots.header">), footer → "conditional" (sits inside <footer r-if="$slots.footer">), default → "always"');
});
