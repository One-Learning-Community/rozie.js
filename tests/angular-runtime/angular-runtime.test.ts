// Phase 80 Plan 03 (Task 3) — the six R7 runtime tests, run against the
// CURRENT (pre-fix) emitter and committed in a deliberately RED state. SPEC
// R7 / D-07 (fail-first-proof-by-git-history): "a test never observed red
// does not satisfy this requirement." Do NOT "fix" this file — the fix
// lands in Plans 04/05, a later wave.
//
// Mounting shape (RESEARCH Pattern 4 / Pitfall 3, adapted for real AOT):
// each consumer fixture is compiled through the SAME
// `Rozie({ target: 'angular' }) + angular({ jit: false })` Vite pipeline
// vitest.config.ts wires for every other file in this package — a plain ES
// `import` of a `.rozie` specifier is enough; @rozie/unplugin's D-70
// disk-cache prebuild + cross-rozie shim (see fixtures.compile.test.ts's
// sibling comment and .gitignore) already resolves the consumer's emitted
// extension-less `./ProducerRecordPath` import to the separately compiled
// producer module, so there is no manual import-map wiring left to do —
// that whole mechanism belonged to the discarded JIT/eval harness (D-07b).
// Mount the CONSUMER only; a content query on a producer with nothing
// projected into it is always empty and would prove nothing.
import { TestBed } from '@angular/core/testing';
import { ensureTestBedInit } from './testBedInit';

import { ConsumerTopLevel } from './fixtures/ConsumerTopLevel.rozie';
import { ConsumerInsideIf } from './fixtures/ConsumerInsideIf.rozie';
import { ConsumerInsideFor } from './fixtures/ConsumerInsideFor.rozie';
import { ConsumerSiblingProducers } from './fixtures/ConsumerSiblingProducers.rozie';
import { ConsumerEmptyKeyFill } from './fixtures/ConsumerEmptyKeyFill.rozie';

// Phase 80 Plan 07 (Task 2) additions — precedence, key-domain, prototype
// guard, dev-vs-production warning behavior, and the bare-attribute
// contract.
import { ConsumerPrecedence } from './fixtures/ConsumerPrecedence.rozie';
import { ConsumerNullishKeyFill } from './fixtures/ConsumerNullishKeyFill.rozie';
import { ConsumerDuplicateRuntimeKeys } from './fixtures/ConsumerDuplicateRuntimeKeys.rozie';
import {
  PrecedenceHostContentChildWins,
  PrecedenceHostDirectiveWins,
  PrecedenceHostTemplatesWins,
  PrecedenceHostDefaultWins,
} from './hosts/PrecedenceHosts';
import { PrototypeGuardHost } from './hosts/PrototypeGuardHost';
import { EmptyFillMapHost } from './hosts/EmptyFillMapHost';
import { BareAttributeHost } from './hosts/BareAttributeHost';

/**
 * Save/restore the ngDevMode global around a test so it never leaks.
 *
 * Angular's OWN internals read+mutate `globalThis.ngDevMode` as an OBJECT of
 * performance counters (`ngDevMode.tView++`, etc.) whenever dev mode is
 * active — NOT a bare boolean. Setting it to the boolean literal `true`
 * clobbers that object and crashes Angular's own `createTView` with
 * "Cannot create property 'tView' on boolean 'true'" the moment ANY
 * component is created, unrelated to RozieSlot or NG0203 (discovered
 * empirically while authoring this test). An empty object `{}` is truthy
 * (satisfies the emitted `if (!(globalThis...).ngDevMode || ...)` guard
 * exactly like a boolean `true` would) AND accepts arbitrary counter
 * properties without throwing, so it is used here instead of a boolean.
 */
function withDevMode<T>(on: boolean, fn: () => T): T {
  const g = globalThis as { ngDevMode?: unknown };
  const prev = g.ngDevMode;
  g.ngDevMode = on ? {} : false;
  try {
    return fn();
  } finally {
    g.ngDevMode = prev;
  }
}

describe('angular-runtime — R7 fail-first record-path slot-fill proof (pre-fix emitter)', () => {
  it('1. top-level fill — baseline, must pass BOTH pre-fix and post-fix', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerTopLevel] });
    const fixture = TestBed.createComponent(ConsumerTopLevel);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('TOP:alpha');
    expect(text).not.toContain('[DYN-FALLBACK]');

    fixture.destroy();
  });

  it('2. fill inside r-if — a static view query never resolves a reference inside an embedded view', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerInsideIf] });
    const fixture = TestBed.createComponent(ConsumerInsideIf);
    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('IF-FILL');
    expect(text).not.toContain('[DYN-FALLBACK]');

    fixture.destroy();
  });

  it('3. fill inside r-for — asserts the DESIRED post-fix behavior; see RED-EVIDENCE.md for the observed pre-fix failure', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerInsideFor] });
    const fixture = TestBed.createComponent(ConsumerInsideFor);
    // Observed pre-fix failure mode (RED-EVIDENCE.md): NOT the "returns
    // iteration zero" behavior anticipated in the plan prose — a harder
    // failure. The emitted `templates` getter is `{ [col.key]:
    // this.__dynSlot_0! }`, referencing `col` (the `@for` loop's own
    // template-local variable) from CLASS-LEVEL scope, where it does not
    // exist. `detectChanges()` throws `ReferenceError: col is not defined`
    // synchronously. These assertions are left as the DESIRED post-fix
    // behavior (unreachable pre-fix, since the exception above propagates
    // out of this `it()` body first) so this same test file becomes the
    // GREEN observation once Plans 04/05 land, with no rewrite needed.
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('FOR:alpha');
    expect(text).toContain('FOR:beta');
    expect(text).not.toContain('[DYN-FALLBACK]');

    fixture.destroy();
  });

  it('4. two sibling producers — dynIdx resets per producer tag, colliding template ref names', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerSiblingProducers] });
    const fixture = TestBed.createComponent(ConsumerSiblingProducers);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Assert the COUNTS, not mere presence. Observed pre-fix failure mode
    // (RED-EVIDENCE.md): `dynIdx` resets per producer tag, so both
    // producers' fills share the template ref name `__dynSlot_0`, AND the
    // `templates` getter only emits an entry for the FIRST producer's key
    // — the second producer's fill is silently dropped entirely (SIB-B
    // renders zero times), not duplicated. A presence-only assertion on
    // SIB-A alone would not catch this — SIB-A renders correctly by
    // coincidence (first-declared wins the duplicate-name ViewChild
    // query) while SIB-B silently vanishes.
    const sibACount = text.split('SIB-A').length - 1;
    const sibBCount = text.split('SIB-B').length - 1;
    expect(sibACount).toBe(1);
    expect(sibBCount).toBe(1);

    fixture.destroy();
  });

  it('5. late-arriving fill — an r-if that flips false to true', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerInsideIf] });
    const fixture = TestBed.createComponent(ConsumerInsideIf);
    fixture.detectChanges();

    const textBefore = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textBefore).not.toContain('IF-FILL');
    expect(textBefore).not.toContain('[DYN-FALLBACK]');

    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const textAfter = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(textAfter).toContain('IF-FILL');

    fixture.destroy();
  });

  it("6. empty-string key resolves to the producer's DEFAULT slot (D-06)", () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerEmptyKeyFill] });
    const fixture = TestBed.createComponent(ConsumerEmptyKeyFill);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('EMPTY-FILL');
    expect(text).not.toContain('[DEFAULT-FALLBACK]');

    fixture.destroy();
  });
});

// Phase 80 Plan 07 (Task 2) — the precedence chain, key-domain edges,
// prototype-pollution guard, and dev-vs-production warning behavior.
//
// RESOLVED by Plan 08: every test below that projects a REAL `[rozieSlot]`
// marker (constructing an actual `RozieSlot` instance imported from
// `@rozie/runtime-angular`) previously threw NG0203 at `detectChanges()`
// — OPEN RISK R-80-NG0203, closed in Plan 08 by
// `angularPartialIvyLinkerPlugin()` (links the package's partial-Ivy
// declarations) plus `resolve.dedupe` in vitest.config.ts (collapses the
// dual-package-hazard duplicate `@angular/core` instance the linker fix
// alone did not address — see that file for both root causes). Test
// titles below still say "blocked by NG0203 today" / "DESIRED post-fix" —
// left as-is deliberately: they are the literal RED-EVIDENCE.md-style
// historical record of what Plan 07 could and could not prove, and now
// serve as the GREEN observation for the SAME assertions, per the
// convention RED-EVIDENCE.md already establishes for test 3 above.
describe('angular-runtime — precedence, key-domain, prototype guard, dev/prod warnings (Phase 80 Plan 07)', () => {
  it('precedence tier 4->1: templates-only input wins over the producer default (NOT blocked by NG0203 — no RozieSlot instance)', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PrecedenceHostTemplatesWins] });
    const fixture = TestBed.createComponent(PrecedenceHostTemplatesWins);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('PREC-TEMPLATES');
    expect(text).not.toContain('[DEFAULT-FALLBACK]');

    fixture.destroy();
  });

  it('precedence tier 4: nothing supplied, the producer default wins (NOT blocked by NG0203 — no RozieSlot instance)', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PrecedenceHostDefaultWins] });
    const fixture = TestBed.createComponent(PrecedenceHostDefaultWins);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('[DEFAULT-FALLBACK]');
    expect(text).not.toContain('PREC-TEMPLATES');

    fixture.destroy();
  });

  it('precedence tier 2: directive-only fill wins over templates (DESIRED post-fix — blocked by NG0203 today)', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerPrecedence] });
    const fixture = TestBed.createComponent(ConsumerPrecedence);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('PREC-DIRECTIVE');
    expect(text).not.toContain('[DEFAULT-FALLBACK]');

    fixture.destroy();
  });

  it('precedence tier 2 beats tier 3: directive fill wins over a templates binding on the SAME slot (DESIRED post-fix — blocked by NG0203 today)', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PrecedenceHostDirectiveWins] });
    const fixture = TestBed.createComponent(PrecedenceHostDirectiveWins);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('PREC-DIRECTIVE');
    expect(text).not.toContain('PREC-TEMPLATES');

    fixture.destroy();
  });

  it('precedence tier 1 beats tiers 2 and 3: a static @ContentChild fill wins over BOTH a directive fill AND a templates binding on the SAME slot (DESIRED post-fix — blocked by NG0203 today)', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PrecedenceHostContentChildWins] });
    const fixture = TestBed.createComponent(PrecedenceHostContentChildWins);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('PREC-CONTENTCHILD');
    expect(text).not.toContain('PREC-DIRECTIVE');
    expect(text).not.toContain('PREC-TEMPLATES');

    fixture.destroy();
  });

  it('a fill bound to an undefined key contributes no map entry and the producer falls through to its default (R5 — DESIRED post-fix, blocked by NG0203 today)', () => {
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ConsumerNullishKeyFill] });
    const fixture = TestBed.createComponent(ConsumerNullishKeyFill);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('[DYN-FALLBACK]');
    expect(text).not.toContain('NULLISH-FILL');

    fixture.destroy();
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'a %s-keyed fill never reaches the map and never mutates Object.prototype (T-80-01)',
    (dangerKey) => {
      // Snapshot BEFORE mounting, via the reflective API rather than
      // property access. `({})[dangerKey]` looked correct for `'constructor'`
      // and `'prototype'` (ordinary own-property lookups) but is WRONG for
      // `'__proto__'`: bracket/dot access on that literal name invokes
      // `Object.prototype`'s own legacy `__proto__` ACCESSOR (Annex B),
      // which always returns the prototype chain link — `Object.prototype`
      // itself on a fresh `{}`, and `null` when read off `Object.prototype`
      // — regardless of whether the guard leaked anything. That made the
      // original per-case assertion compare `Object.prototype` to `null`
      // unconditionally for the `__proto__` case, independent of the
      // guard's real behavior. `Object.getOwnPropertyDescriptor` is a
      // reflective call: it treats `__proto__` as an ordinary string key,
      // not the special accessor syntax, so a before/after descriptor
      // comparison is the key-agnostic way to assert "nothing was added,
      // removed, or altered on Object.prototype" across all three
      // dangerous keys. Found empirically: NG0203 (fixed in Plan 08) had
      // masked this pre-existing test bug by crashing before this
      // assertion was ever reached.
      const before = Object.getOwnPropertyDescriptor(Object.prototype, dangerKey);

      ensureTestBedInit();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [PrototypeGuardHost] });
      const fixture = TestBed.createComponent(PrototypeGuardHost);
      fixture.componentRef.setInput('dangerKey', dangerKey);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('[DYN-FALLBACK]');
      expect(text).not.toContain('DANGER-FILL');

      // The guard's whole point: Object.prototype must be byte-for-byte
      // unchanged by mounting a component whose fill key is one of the
      // three dangerous names.
      const after = Object.getOwnPropertyDescriptor(Object.prototype, dangerKey);
      expect(after).toEqual(before);

      fixture.destroy();
    },
  );

  it('two fills whose keys evaluate equal at runtime warn exactly once with dev mode on, and the LAST fill (content-query order) renders (R6 — DESIRED post-fix, blocked by NG0203 today)', () => {
    withDevMode(true, () => {
      ensureTestBedInit();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ConsumerDuplicateRuntimeKeys] });
      const fixture = TestBed.createComponent(ConsumerDuplicateRuntimeKeys);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('DUP-SECOND');
      expect(text).not.toContain('DUP-FIRST');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain('ROZ750');

      warnSpy.mockRestore();
      fixture.destroy();
    });
  });

  it('the SAME duplicate-runtime-key case produces zero console output with dev mode off (R6 prod-silence — DESIRED post-fix, blocked by NG0203 today)', () => {
    withDevMode(false, () => {
      ensureTestBedInit();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ConsumerDuplicateRuntimeKeys] });
      const fixture = TestBed.createComponent(ConsumerDuplicateRuntimeKeys);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      fixture.detectChanges();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      logSpy.mockRestore();
      fixture.destroy();
    });
  });

  it('a producer receiving projected template content with zero collected keyed fills warns once with dev mode on (NOT blocked by NG0203 — no RozieSlot instance)', () => {
    withDevMode(true, () => {
      ensureTestBedInit();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [EmptyFillMapHost] });
      const fixture = TestBed.createComponent(EmptyFillMapHost);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fixture.detectChanges();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain('ROZ750');

      warnSpy.mockRestore();
      fixture.destroy();
    });
  });

  it('the SAME empty-fill-map case is silent with dev mode off (NOT blocked by NG0203 — no RozieSlot instance)', () => {
    withDevMode(false, () => {
      ensureTestBedInit();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [EmptyFillMapHost] });
      const fixture = TestBed.createComponent(EmptyFillMapHost);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fixture.detectChanges();

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      fixture.destroy();
    });
  });

  it("a bare `rozieSlot` attribute with no bound value resolves to the empty string and folds to the producer's DEFAULT slot, per D-06 — R2 (Plan 08 correction)", () => {
    // Plan 08 empirically falsified this test's original assumption (SPEC.md
    // line 38 / the edge-probe table: "a bare `<ng-template rozieSlot>` with
    // no bound value throws Angular's NG0950 at first read"). That assumption
    // was written before any fixture existed and was never actually
    // reachable pre-fix — OPEN RISK R-80-NG0203 crashed BEFORE this
    // assertion could ever run, masking the gap. Once NG0203 was fixed
    // (this plan), mounting `BareAttributeHost` revealed the real Angular
    // template-binder contract: a value-less HTML attribute matching a
    // directive's input name (`<ng-template rozieSlot>`, no `=`, no `[...]`)
    // is NOT "the input left unset" — it is a STATIC binding of the empty
    // string, identical in effect to `rozieSlot=""`. `input.required<string>()`
    // is fully satisfied by `''`, so no NG0950 is possible for this specific
    // shape; the directive's selector (`ng-template[rozieSlot]`) requires
    // the attribute to be present in the first place, so "present but truly
    // unset" is not a reachable state through this syntax at all.
    //
    // What DOES happen is the D-06 fold this phase already implements and
    // already proves elsewhere (test 6, `ConsumerEmptyKeyFill`): the
    // producer's `__rozieFillMap` normalizes an empty-string key to
    // `'defaultSlot'`, so the bare-attribute fill resolves to the
    // producer's DEFAULT slot exactly like an explicit `[rozieSlot]="''"`
    // would. This is the CORRECT, coherent behavior — not a rough edge to
    // paper over — and per 80-CONTEXT.md's standing instruction, contrary
    // evidence is documented here rather than silently complied with.
    ensureTestBedInit();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [BareAttributeHost] });

    const fixture = TestBed.createComponent(BareAttributeHost);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('BARE-FILL');
    expect(text).not.toContain('[DEFAULT-FALLBACK]');

    fixture.destroy();
  });
});
