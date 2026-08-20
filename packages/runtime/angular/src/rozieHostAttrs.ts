/**
 * `createRozieHostAttrsReader` — the synthesised `$attrs` auto-fallthrough
 * reader factory (Quick task 260819-sg9, Tier 2).
 *
 * Plan 14-05 — the Angular target's `$attrs` lowering. Angular has no
 * native `$attrs` proxy (cf. Vue's template-side `$attrs` magic accessor).
 * The consumer's attributes land on the host custom element
 * (`<rozie-foo id="x">`); auto-fallthrough must re-project them onto the
 * TEMPLATE-ROOT element (CONTEXT.md A1).
 *
 * The reader reads attributes from the host element on each call so a
 * consumer-side dynamic binding (`[id]="someSignal()"`) flows through on
 * the next effect re-run (Angular reflects the binding onto the host DOM
 * attribute; the next applier invocation sees the new value).
 *
 * CALLER-INJECTS CONTRACT (Tier 2, 260819-sg9) — this used to be an inlined
 * private-field IIFE that called `inject(ElementRef)` itself
 * (`packages/targets/angular/src/emit/emitTemplateAttribute.ts`,
 * `hostAttrsGetterDecl()`, deleted by this quick task). The emitted
 * component still performs `inject(ElementRef)` in its own field
 * initializer (injection context per Phase 05 Pitfall 8) and passes the
 * resolved instance in as `createRozieHostAttrsReader(inject(ElementRef))`
 * — this module never names an Angular value or type, only the structural
 * `RozieHostRef` interface below. The host element is captured ONCE by the
 * caller-supplied reference; only the attribute read iterates per call.
 *
 * @public — runtime API consumed by emitted Angular .ts files.
 */

/**
 * The structural subset of `ElementRef` this reader needs. Defined locally
 * (not imported from Angular's core package) so this module names no Angular type
 * — `ElementRef<any>.nativeElement` widens to `unknown`, which is assignable
 * here without a cast (proven during planning against the real Angular 19
 * types).
 */
export interface RozieHostRef {
  readonly nativeElement: unknown;
}

/**
 * Build a `() => Record<string, unknown>` reader bound to the
 * caller-supplied host reference.
 */
export function createRozieHostAttrsReader(host: RozieHostRef): () => Record<string, unknown> {
  return () => {
    const el = host.nativeElement as HTMLElement;
    const out: Record<string, unknown> = {};
    for (const a of Array.from(el.attributes)) out[a.name] = a.value;
    return out;
  };
}
