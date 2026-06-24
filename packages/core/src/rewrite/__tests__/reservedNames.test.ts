// Phase 61 Plan 01 — pin the cross-target reserved-name tables (the single
// source of truth in reservedNames.ts) + the widened reservedClassMembers()
// against regression. Half A (auto-deconflict) and Half B (lint validator) both
// consume these; a silent drift would re-open the per-leaf-typecheck discovery
// these tables exist to replace. Each assertion below restates a Task 1/2
// acceptance-criterion membership fact.
import { describe, it, expect } from 'vitest';
import {
  LIT_DOM_MEMBERS,
  LIT_LIFECYCLE_MEMBERS,
  LIT_EMITTER_MEMBERS,
  ANGULAR_CVA_MEMBERS,
  ANGULAR_LIFECYCLE_MEMBERS,
  ANGULAR_EMITTER_MEMBERS,
  ANGULAR_DI_TOKENS,
  VUE_RESERVED_PROPS,
  VUE_EMITTER_BINDINGS,
  VUE_IMPORT_NAMES,
  VUE_RUNTIME_IMPORTS,
  SVELTE_RUNE_NAMES,
  SVELTE_EMITTER_NAMES,
  SVELTE_RUNTIME_IMPORTS,
  SOLID_EMITTER_LOCALS,
  SOLID_IMPORT_NAMES,
  REACT_RESERVED_PROPS,
  JS_RESERVED_WORDS,
  OBJECT_PROTOTYPE_MEMBERS,
} from '../reservedNames.js';
import { reservedClassMembers } from '../deconflict.js';

describe('reservedNames — Lit tables (collision-lit §2)', () => {
  it('Group A includes the full DOM chain incl popover/inert/aria*/enterKeyHint', () => {
    for (const n of [
      'popover', 'inert', 'enterKeyHint', 'ariaLabel', 'ariaExpanded',
      'autocapitalize', 'autocorrect', 'nonce', 'translate', 'editContext',
      'attachInternals', 'hidePopover', 'showPopover', 'togglePopover',
      'assignedSlot', 'id', 'title', 'focus', 'scrollTo', 'nodeType',
    ]) {
      expect(LIT_DOM_MEMBERS.has(n)).toBe(true);
    }
  });

  it('Group C lifecycle includes render/requestUpdate/updated + accessors', () => {
    for (const n of [
      'render', 'requestUpdate', 'updated', 'connectedCallback',
      'disconnectedCallback', 'firstUpdated', 'willUpdate', 'updateComplete',
    ]) {
      expect(LIT_LIFECYCLE_MEMBERS.has(n)).toBe(true);
    }
  });

  it('Group D emitter members include the unconditional names', () => {
    for (const n of ['_disconnectCleanups', '_rozieTornDown', '_armListeners']) {
      expect(LIT_EMITTER_MEMBERS.has(n)).toBe(true);
    }
  });
});

describe('reservedNames — Angular tables (collision-angular §2)', () => {
  it('CVA quartet present (single-model-conditional set)', () => {
    for (const n of [
      'writeValue', 'registerOnChange', 'registerOnTouched', 'setDisabledState',
    ]) {
      expect(ANGULAR_CVA_MEMBERS.has(n)).toBe(true);
    }
  });

  it('lifecycle set includes ngOn*/ngAfter* + constructor', () => {
    for (const n of [
      'ngOnInit', 'ngOnDestroy', 'ngAfterViewInit', 'ngOnChanges', 'constructor',
    ]) {
      expect(ANGULAR_LIFECYCLE_MEMBERS.has(n)).toBe(true);
    }
  });

  it('emitter internals + DI tokens present', () => {
    expect(ANGULAR_EMITTER_MEMBERS.has('__rozieDestroyRef')).toBe(true);
    expect(ANGULAR_EMITTER_MEMBERS.has('templates')).toBe(true);
    expect(ANGULAR_DI_TOKENS.has('signal')).toBe(true);
    expect(ANGULAR_DI_TOKENS.has('inject')).toBe(true);
    expect(ANGULAR_DI_TOKENS.has('forwardRef')).toBe(true);
  });
});

describe('reservedNames — Vue tables (collision-vue §2)', () => {
  it('reserved props set A includes key/ref/ref_for/ref_key/is', () => {
    for (const n of ['key', 'ref', 'ref_for', 'ref_key', 'is']) {
      expect(VUE_RESERVED_PROPS.has(n)).toBe(true);
    }
  });

  it('emitter bindings + import + runtime sets present', () => {
    expect(VUE_EMITTER_BINDINGS.has('props')).toBe(true);
    expect(VUE_EMITTER_BINDINGS.has('emit')).toBe(true);
    expect(VUE_IMPORT_NAMES.has('computed')).toBe(true);
    expect(VUE_RUNTIME_IMPORTS.has('rozieDeepClone')).toBe(true);
  });
});

describe('reservedNames — Svelte tables (collision-svelte §2)', () => {
  it('runes set includes $bindable/$inspect/$host', () => {
    for (const n of ['$props', '$state', '$bindable', '$inspect', '$host']) {
      expect(SVELTE_RUNE_NAMES.has(n)).toBe(true);
    }
  });

  it('emitter names + runtime imports present', () => {
    expect(SVELTE_EMITTER_NAMES.has('children')).toBe(true);
    expect(SVELTE_EMITTER_NAMES.has('snippets')).toBe(true);
    expect(SVELTE_RUNTIME_IMPORTS.has('onMount')).toBe(true);
    expect(SVELTE_RUNTIME_IMPORTS.has('getContext')).toBe(true);
  });
});

describe('reservedNames — Solid tables escape the class-field half (collision-solid §4)', () => {
  it('emitter locals + imports present', () => {
    expect(SOLID_EMITTER_LOCALS.has('local')).toBe(true);
    expect(SOLID_EMITTER_LOCALS.has('attrs')).toBe(true);
    expect(SOLID_IMPORT_NAMES.has('splitProps')).toBe(true);
    expect(SOLID_IMPORT_NAMES.has('children')).toBe(true);
  });

  it('contains NO DOM/Object.prototype/CVA names (plain function, no class)', () => {
    for (const n of ['nodeType', 'valueOf', 'focus', 'writeValue', 'toString']) {
      expect(SOLID_EMITTER_LOCALS.has(n)).toBe(false);
      expect(SOLID_IMPORT_NAMES.has(n)).toBe(false);
    }
  });
});

describe('reservedNames — React + shared tables (collision-react §2/§3.G)', () => {
  it('React SILENT-tier reserved props = key/ref/children/dangerouslySetInnerHTML', () => {
    for (const n of ['key', 'ref', 'children', 'dangerouslySetInnerHTML']) {
      expect(REACT_RESERVED_PROPS.has(n)).toBe(true);
    }
    // React escapes the class-field half — no DOM/Object.prototype names.
    expect(REACT_RESERVED_PROPS.has('nodeType')).toBe(false);
    expect(REACT_RESERVED_PROPS.has('valueOf')).toBe(false);
  });

  it('JS reserved words shared across targets', () => {
    for (const n of ['in', 'class', 'for', 'default', 'new', 'function']) {
      expect(JS_RESERVED_WORDS.has(n)).toBe(true);
    }
  });
});

describe('reservedClassMembers() — widened (deconflict.ts, Task 2)', () => {
  it('lit set covers Group C lifecycle + Group A DOM seed', () => {
    const lit = reservedClassMembers('lit');
    // Group C lifecycle (R-NEW-2)
    expect(lit.has('render')).toBe(true);
    expect(lit.has('requestUpdate')).toBe(true);
    expect(lit.has('updated')).toBe(true);
    // Group A seed completeness (R-NEW-6) — present even bare-Node
    expect(lit.has('popover')).toBe(true);
    expect(lit.has('ariaLabel')).toBe(true);
    // Group B Object.prototype back-compat
    expect(lit.has('valueOf')).toBe(true);
  });

  it('angular (no opts) covers lifecycle + constructor but NOT the CVA quartet', () => {
    const ng = reservedClassMembers('angular');
    expect(ng.has('ngOnInit')).toBe(true);
    expect(ng.has('ngAfterViewInit')).toBe(true);
    expect(ng.has('constructor')).toBe(true);
    // CVA is single-model-gated — absent with no opts
    expect(ng.has('writeValue')).toBe(false);
    expect(ng.has('registerOnChange')).toBe(false);
    // back-compat: every Object.prototype name still present
    for (const n of OBJECT_PROTOTYPE_MEMBERS) expect(ng.has(n)).toBe(true);
    // angular is NOT a DOM target — focus stays out
    expect(ng.has('focus')).toBe(false);
  });

  it('angular { singleModel: true } folds in the CVA quartet', () => {
    const ng = reservedClassMembers('angular', { singleModel: true });
    for (const n of [
      'writeValue', 'registerOnChange', 'registerOnTouched', 'setDisabledState',
    ]) {
      expect(ng.has(n)).toBe(true);
    }
    // lifecycle still present alongside
    expect(ng.has('ngOnInit')).toBe(true);
  });
});
