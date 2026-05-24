# For Angular shops

The Angular template DSL is the canonical "I like my framework but I hate
the syntax" pain point. `*ngFor`, decorator soup, `[(ngModel)]` ceremony,
constructor-DI noise, the standalone-components migration tax — they're
all things Angular users have asked their framework to fix for years.

Rozie isn't a migration tool — it doesn't ask you to leave Angular. It's a
**Vue-flavored authoring layer that compiles to idiomatic Angular 19+**:
standalone components, signals, the new `@if` / `@for` block syntax,
`input.required<T>()`, `model<T>()`, `output<T>()`, `inject(DestroyRef)`.

You write one `.rozie` component this week. The compiled `.ts` drops into
your existing Angular app as a standalone component. Nothing else changes.

## What you write vs what Angular sees

### Side by side — a debounced search input

Hand-written Angular standalone component:

```ts
// SearchInput.ts (hand-written Angular)
import { Component, signal, computed, effect, input, output, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

@Component({
  selector: 'rz-search-input',
  standalone: true,
  template: `
    <input
      [value]="query()"
      (input)="onInput($any($event.target).value)"
      [placeholder]="placeholder()"
    />
    @if (query().length > 0) {
      <button (click)="clear()">×</button>
    }
  `,
  styles: [`
    input { padding: 0.5rem; border: 1px solid #ddd; }
    button { margin-left: 0.5rem; }
  `],
})
export class SearchInput {
  placeholder = input<string>('Search…');
  search = output<string>();

  protected query = signal('');
  private debouncer = new Subject<string>();
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.debouncer.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(v => this.search.emit(v));
  }

  protected onInput(value: string) {
    this.query.set(value);
    this.debouncer.next(value);
  }

  protected clear() {
    this.query.set('');
    this.search.emit('');
  }
}
```

The same component in Rozie:

```rozie
<rozie name="SearchInput">

<props>
{
  placeholder: { type: String, default: 'Search…' },
}
</props>

<data>
{ query: '' }
</data>

<script>
const clear = () => { $data.query = ''; $emit('search', '') }
</script>

<template>
<input
  :value="$data.query"
  @input.debounce(300)="$data.query = $event.target.value; $emit('search', $data.query)"
  :placeholder="$props.placeholder"
/>
<button r-if="$data.query.length > 0" @click="clear">×</button>
</template>

<style>
input  { padding: 0.5rem; border: 1px solid #ddd; }
button { margin-left: 0.5rem; }
</style>

</rozie>
```

The Rozie compiler emits an Angular standalone component that's
**structurally equivalent** to the hand-written version above — the same
`signal()` / `input()` / `output()` / `inject(DestroyRef)` / `effect()`
machinery, with `@for` / `@if` blocks in the template. You don't see it
during authoring. You import it normally:

```ts
// app.component.ts
import { Component } from '@angular/core';
import { SearchInput } from './SearchInput'; // compiled from SearchInput.rozie

@Component({
  standalone: true,
  imports: [SearchInput],
  template: `<rz-search-input (search)="onSearch($event)" />`,
})
export class AppComponent {
  onSearch(query: string) { /* … */ }
}
```

## What you don't have to write anymore

Rozie quietly does the Angular ceremony you'd otherwise hand-roll:

| Angular thing | What Rozie handles |
| --- | --- |
| `signal()` / `computed()` / `effect()` | `<data>` → `signal()`, `$computed` → `computed()`, `$watch` → `effect()` |
| `input.required<T>()` vs `input<T>()` | `required: true` on a `<props>` member — single source of truth across all six targets. |
| `model<T>()` for two-way binding | `model: true` on a `<props>` member; consumer-side `r-model:propName="…"` |
| `output<T>()` + emitting | `$emit('eventname', payload)` |
| `inject(DestroyRef)` + paired cleanup | `$onMount` returning a cleanup fn — Rozie hoists `private __rozieDestroyRef = inject(DestroyRef)` automatically. |
| `ngAfterViewInit` for `$el`-touching code | `$onMount` lowers to `ngAfterViewInit()` so `viewChild()` signals are populated when your code runs. |
| `Renderer2.listen` + global event cleanup | `<listeners>` block with reactive `when:` predicate. Auto-cleanup on destroy. |
| `*ngTemplateOutlet` + context-guard ceremony | `<slot name="x" :value="…" />` — typed scoped slots with one declaration. |
| Inline arrow functions in `*ngTemplateOutlet context` (Angular template parser rejects them) | Rozie pre-binds slot-context closures. |
| `:host` + `::ng-deep` for global rules | `:root { … }` inside `<style>`. |

## Incremental adoption

### Step 1: Pick the lowest-friction install path

If you're on Angular 17+ with the default Application Builder, you have two
options:

**Option A — Pre-compile (recommended for first try):** Use the Rozie CLI
to emit a `.ts` file you check in. No build-time integration; the output is
a normal standalone component.

```bash
pnpm add -D @rozie/cli
pnpm rozie build src/app/Counter.rozie --target angular --out src/app/Counter.ts
```

**Option B — Build-time integration:** If your project already uses the
AnalogJS Vite-based Angular toolchain
(`@analogjs/vite-plugin-angular`), drop in `@rozie/unplugin/vite`. See the
[Install guide](/guide/install) for the workspace setup, including the
pnpm `packageExtensions` patch for analogjs's phantom peer-dependency
behavior.

### Step 2: Write one component in Rozie

Pick a component that doesn't have hot dependencies — a leaf component like
a button, badge, modal, or input. Author it as a `.rozie` file using the
[Quick Start](/guide/quick-start) template.

### Step 3: Import + use it like a regular standalone component

```ts
import { Component } from '@angular/core';
import { YourRozieComponent } from './YourRozieComponent'; // .rozie → .ts

@Component({
  standalone: true,
  imports: [YourRozieComponent],
  template: `<rz-your-rozie-component [value]="42" />`,
})
export class HostComponent {}
```

### Step 4: Decide if you like it

If the team likes the authoring ergonomics, expand. If not, the compiled
`.ts` is a normal Angular standalone component — you can keep using it,
delete the `.rozie` source, and the `.ts` works on its own. Zero lock-in.

## What's idiomatic — what isn't

### Idiomatic

- `signal()` / `computed()` / `effect()` / `inject(DestroyRef)`
- `input()` / `input.required()` / `model()` / `output()` / `viewChild()`
- Standalone components, no NgModule
- `@for` / `@if` block syntax (not `*ngFor` / `*ngIf`)
- `Renderer2.listen` for `<listeners>` block
- Strict-templates clean (validated under `ngc --strictTemplates` for the
  reference + engine-wrapper examples)
- ChangeDetection: signal-driven, no zone.js round-trips for state updates

### Not in v1 (documented edge)

- **Modifier `valueTransform` must be a pure expression**, not a statement
  block — Angular's template parser splices the fragment verbatim into a
  binding expression. (`registerModifier()` plugins targeting Angular
  should keep the `valueTransform` short and expression-shaped.)
- **`$watch` vs `$onMount` ordering**: immediate `$watch` fires *before*
  `$onMount` on Angular (and Vue). React/Svelte/Solid/Lit fire it after.
  Engine-wrapper reconcilers should be idempotent no-ops to stay safe.
- **TypeScript floor 5.6+** — Angular 19's own peer dep is `>=5.5.0 <5.9.0`,
  which sits inside our floor. Older TS isn't tested.

## Why Angular shops in particular

Three things make Angular the strongest fit for this pitch:

1. **The pain delta is the widest.** Vue-flavored SFC syntax is the
   single largest leap from Angular's authoring ergonomics — far more so
   than from React (which is already JSX-y) or Svelte (also block-based).
2. **The compiled output is fully native.** Rozie emits signals,
   standalone components, modern block syntax, and `inject(DestroyRef)` —
   the *exact* Angular Angular shops are trying to migrate to from older
   patterns. Rozie isn't a parallel runtime; it's the Angular you'd write
   if you had perfect taste.
3. **Strict-templates clean.** The compiler's output passes `ngc
   --strictTemplates` for every reference example. Type-safety doesn't
   degrade.

## Next steps

- [Quick Start](/guide/quick-start) — write your first `.rozie` file.
- [Adopt incrementally](/guide/adopt-incrementally) — full per-stack
  install walkthrough.
- [Examples](/examples/) — full source + Angular output for every
  reference component.
- [Compatibility](/compatibility) — feature × target matrix.
