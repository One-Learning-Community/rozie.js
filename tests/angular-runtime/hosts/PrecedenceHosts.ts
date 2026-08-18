// Phase 80 Plan 07 (Task 2) — hand-written Angular hosts driving the two
// precedence tiers `ConsumerPrecedence.rozie` cannot express: a static
// `#defaultSlot` content-child fill, and a programmatically-bound `templates`
// input. Real `RozieSlot` import from `@rozie/runtime-angular` (NOT a local
// copy) — per 80-CONTEXT.md's OPEN RISK R-80-NG0203 note, these tests must
// prove behavior against the SHIPPED artifact, not a workaround copy. All
// four hosts target `ProducerRecordPath`'s DEFAULT slot (key `'defaultSlot'`)
// — the only slot on that producer carrying a static `@ContentChild`, the
// content-collected fill map, the `templates` input, AND a declared default
// (`[DEFAULT-FALLBACK]`) all at once (see ProducerRecordPath.rozie.ts).
//
// Four separate components (not one parametrized component) because each
// step of the precedence walk needs to physically REMOVE a tier's projected
// content — Angular has no runtime toggle for "is this ng-template
// projected at all", so each combination is its own host.
import { Component, TemplateRef, viewChild } from '@angular/core';
import { RozieSlot } from '@rozie/runtime-angular';
import { ProducerRecordPath } from '../fixtures/ProducerRecordPath';

/** Tier 1 present (alongside tiers 2 and 3) — @ContentChild must win. */
@Component({
  selector: 'precedence-host-content-child-wins',
  standalone: true,
  imports: [RozieSlot, ProducerRecordPath],
  template: `
    <ng-template #tplSrc>PREC-TEMPLATES</ng-template>
    <rozie-producer-record-path [templates]="templatesInput()">
      <ng-template #defaultSlot>PREC-CONTENTCHILD</ng-template>
      <ng-template [rozieSlot]="''">PREC-DIRECTIVE</ng-template>
    </rozie-producer-record-path>
  `,
})
export class PrecedenceHostContentChildWins {
  private tplSrc = viewChild.required<TemplateRef<unknown>>('tplSrc');
  templatesInput = () => ({ defaultSlot: this.tplSrc() });
}

/** Tier 1 removed, tiers 2 and 3 present — the directive fill must win. */
@Component({
  selector: 'precedence-host-directive-wins',
  standalone: true,
  imports: [RozieSlot, ProducerRecordPath],
  template: `
    <ng-template #tplSrc>PREC-TEMPLATES</ng-template>
    <rozie-producer-record-path [templates]="templatesInput()">
      <ng-template [rozieSlot]="''">PREC-DIRECTIVE</ng-template>
    </rozie-producer-record-path>
  `,
})
export class PrecedenceHostDirectiveWins {
  private tplSrc = viewChild.required<TemplateRef<unknown>>('tplSrc');
  templatesInput = () => ({ defaultSlot: this.tplSrc() });
}

/** Tiers 1 and 2 removed, only the `templates` input present — it must win. */
@Component({
  selector: 'precedence-host-templates-wins',
  standalone: true,
  imports: [ProducerRecordPath],
  template: `
    <ng-template #tplSrc>PREC-TEMPLATES</ng-template>
    <rozie-producer-record-path [templates]="templatesInput()" />
  `,
})
export class PrecedenceHostTemplatesWins {
  private tplSrc = viewChild.required<TemplateRef<unknown>>('tplSrc');
  templatesInput = () => ({ defaultSlot: this.tplSrc() });
}

/** All three tiers removed — the producer's own declared default must win. */
@Component({
  selector: 'precedence-host-default-wins',
  standalone: true,
  imports: [ProducerRecordPath],
  template: `<rozie-producer-record-path />`,
})
export class PrecedenceHostDefaultWins {}
