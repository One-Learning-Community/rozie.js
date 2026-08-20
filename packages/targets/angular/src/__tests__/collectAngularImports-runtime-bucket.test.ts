/**
 * AngularImportCollector — runtime-package import bucket (Phase 80 Plan 02).
 *
 * `AngularImportCollector` today knows only `@angular/core`, `@angular/common`
 * and `@angular/forms`. This adds a fourth bucket for third-party npm imports
 * — specifically `@rozie/runtime-angular` — following the exact `Set` +
 * `add*()` + size-gated render-branch shape already used by the other three
 * buckets. The size gate is load-bearing: it is the structural mechanism that
 * satisfies the "no runtime dependency for consumers who never touch
 * record-path slots" prohibition (SPEC boundary #2).
 *
 * No call site is added by this test/plan — the producer call site lands in
 * Plan 04 and the consumer call site in Plan 05.
 */
import { describe, it, expect } from 'vitest';
import { AngularImportCollector } from '../rewrite/collectAngularImports.js';

describe('AngularImportCollector — runtime-package import bucket', () => {
  it('renders zero lines mentioning the runtime package when the bucket is empty', () => {
    const collector = new AngularImportCollector();
    const rendered = collector.render();
    expect(rendered).not.toContain('@rozie/runtime-angular');
    expect(collector.hasRuntime('RozieSlot')).toBe(false);
  });

  it('renders exactly one additional import line naming RozieSlot when addRuntime is called', () => {
    const collector = new AngularImportCollector();
    collector.addRuntime('RozieSlot');
    const rendered = collector.render();
    const runtimeLines = rendered
      .split('\n')
      .filter((line) => line.includes('@rozie/runtime-angular'));
    expect(runtimeLines).toHaveLength(1);
    expect(runtimeLines[0]).toBe(`import { RozieSlot } from '@rozie/runtime-angular';`);
  });

  it('renders the runtime line after the @angular/forms line, as the LAST line of render() output', () => {
    const collector = new AngularImportCollector();
    collector.add('Component');
    collector.addCommon('NgClass');
    collector.addForms('FormsModule');
    collector.addRuntime('RozieSlot');
    const rendered = collector.render();
    const lines = rendered.split('\n').filter((line) => line.length > 0);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('@angular/core');
    expect(lines[1]).toContain('@angular/common');
    expect(lines[2]).toContain('@angular/forms');
    expect(lines[3]).toContain('@rozie/runtime-angular');
  });

  it('hasRuntime reflects what was added', () => {
    const collector = new AngularImportCollector();
    expect(collector.hasRuntime('RozieSlot')).toBe(false);
    collector.addRuntime('RozieSlot');
    expect(collector.hasRuntime('RozieSlot')).toBe(true);
  });

  // Quick task 260819-qo8 widened the bucket from RozieSlot-only to also
  // carry rozieDisplay/rozieAttr/rozieToken. rozieDisplay/rozieAttr carry a
  // LOCAL ALIAS (the delegating class methods emitAngular.ts synthesizes
  // share those exported names); rozieToken does not.
  it('renders ONE runtime import line with all four specifiers, sorted by exported name and aliased where applicable', () => {
    const collector = new AngularImportCollector();
    // Add out of alphabetical order to prove render() sorts, not insertion-orders.
    collector.addRuntime('rozieToken');
    collector.addRuntime('rozieDisplay');
    collector.addRuntime('RozieSlot');
    collector.addRuntime('rozieAttr');
    const rendered = collector.render();
    const runtimeLines = rendered
      .split('\n')
      .filter((line) => line.includes('@rozie/runtime-angular'));
    expect(runtimeLines).toHaveLength(1);
    expect(runtimeLines[0]).toBe(
      `import { RozieSlot, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay, rozieToken } from '@rozie/runtime-angular';`,
    );
  });

  it('rozieToken alone renders with no alias', () => {
    const collector = new AngularImportCollector();
    collector.addRuntime('rozieToken');
    const rendered = collector.render();
    expect(rendered).toContain(`import { rozieToken } from '@rozie/runtime-angular';`);
  });
});
