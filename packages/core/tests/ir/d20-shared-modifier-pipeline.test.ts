// Wave 0 scaffold (Plan 02-01 Task 4) — Plan 02-05 fills these in.
//
// IR-03 / D-20: EventBinding.modifierPipeline IR is byte-identical between
// <listeners> blocks and template @event bindings (modulo sourceLoc).
import { describe, it } from 'vitest';

describe('D-20 shared modifier pipeline — Plan 02-05', () => {
  it.todo('.outside($refs.triggerEl, $refs.panelEl).stop in <listeners> context lowers to byte-identical (modulo sourceLoc) modifierPipeline as the same chain in template @event context — D-20 success criterion');
  it.todo('Snapshot pair fixtures/ir/D-20-listeners-context.snap and fixtures/ir/D-20-template-context.snap differ ONLY in sourceLoc fields');
});
