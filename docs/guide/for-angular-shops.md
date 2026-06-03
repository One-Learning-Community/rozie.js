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

This is the canonical `examples/SearchInput.rozie` file — the same one
used as a working consumer in
[`examples/consumers/angular-analogjs/`](https://github.com/One-Learning-Community/rozie.js/tree/main/examples/consumers/angular-analogjs/src),
and the same one the [SearchInput example page](/examples/search-input)
shows compiled to all six targets. The Angular output below is generated
on every docs build by passing the Rozie source through the live
compiler — it cannot drift.

#### What an Angular dev typically writes today

```ts
// SearchInput.ts (hand-written Angular standalone component)
import {
  Component, ElementRef, ViewEncapsulation,
  computed, effect, inject, input, output, signal, viewChild,
  DestroyRef, afterNextRender,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

@Component({
  selector: 'rz-search-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="search-input">
      <input
        #inputEl
        type="search"
        [placeholder]="placeholder()"
        [ngModel]="query()"
        (ngModelChange)="onInput($event)"
        (keydown.enter)="onSearch()"
        (keydown.escape)="onClear()"
      />
      @if (query().length > 0) {
        <button class="clear-btn" (click)="onClear()" aria-label="Clear">×</button>
      } @else {
        <span class="hint">{{ minLength() }}+ chars</span>
      }
    </div>
  `,
  styles: [`
    .search-input { display: inline-flex; align-items: center; gap: 0.25rem; }
    input { padding: 0.25rem 0.5rem; }
    .clear-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; }
    .hint { color: rgba(0, 0, 0, 0.4); font-size: 0.85em; }
  `],
})
export class SearchInput {
  placeholder = input<string>('Search…');
  minLength = input<number>(2);
  autofocus = input<boolean>(false);
  search = output<string>();
  clear = output<void>();

  protected query = signal('');
  protected isValid = computed(() => this.query().length >= this.minLength());
  protected inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  private destroyRef = inject(DestroyRef);
  private debouncer = new Subject<string>();

  constructor() {
    this.debouncer.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.onSearch());

    afterNextRender(() => {
      if (this.autofocus()) this.inputEl()?.nativeElement?.focus();
    });
  }

  protected onInput(value: string) {
    this.query.set(value);
    this.debouncer.next(value);
  }

  protected onSearch() {
    if (this.isValid()) this.search.emit(this.query());
  }

  protected onClear() {
    this.query.set('');
    this.clear.emit();
  }
}
```

#### The same component in Rozie

```rozie-src SearchInput
```

Roughly a third the size, reads top-to-bottom, no decorator soup. The
compiler emits an idiomatic Angular standalone component using the same
`signal()` / `input()` / `output()` / `viewChild()` / `inject(DestroyRef)`
machinery you'd write by hand — see the
[SearchInput example page](/examples/search-input) for the full Angular
output. You don't see it during authoring. You import it normally:

```ts
// app.component.ts
import { Component } from '@angular/core';
import SearchInput from './SearchInput.rozie'; // .rozie → standalone component

@Component({
  standalone: true,
  imports: [SearchInput],
  template: `<rozie-search-input (search)="onSearch($event)" />`,
})
export class AppComponent {
  onSearch(query: string) { /* … */ }
}
```

The working consumer lives at
[`examples/consumers/angular-analogjs/src/app/AppComponent.ts`](https://github.com/One-Learning-Community/rozie.js/tree/main/examples/consumers/angular-analogjs/src/app/AppComponent.ts)
— it imports the same `SearchInput.rozie` shown above and runs the
component inside a real Angular 19+ Application Builder bundle.

## What you don't have to write anymore

Rozie quietly does the Angular ceremony you'd otherwise hand-roll:

| Angular thing | What Rozie handles |
| --- | --- |
| `signal()` / `computed()` / `effect()` | `<data>` → `signal()`, `$computed` → `computed()`, `$watch` → `effect()` |
| `input.required<T>()` vs `input<T>()` | `required: true` on a `<props>` member — single source of truth across all six targets. |
| `model<T>()` for two-way binding | `model: true` on a `<props>` member; consumer-side `r-model:propName="…"` |
| `ControlValueAccessor` + `NG_VALUE_ACCESSOR` provider for custom form controls | A component with exactly **one** `model: true` prop auto-implements `ControlValueAccessor` — `[(ngModel)]`, `[formControl]`, and `formControlName` bind to it like a native control. Touched-on-focusout, `writeValue(null)` → prop default, and disabled-merge wiring included. Opt out with `angular: { cva: false }`. |
| `output<T>()` + emitting | `$emit('eventname', payload)` |
| `inject(DestroyRef)` + paired cleanup | `$onMount` returning a cleanup fn — Rozie hoists `private __rozieDestroyRef = inject(DestroyRef)` automatically. |
| `ngAfterViewInit` for `$el`-touching code | `$onMount` lowers to `ngAfterViewInit()` so `viewChild()` signals are populated when your code runs. |
| `Renderer2.listen` + global event cleanup | `<listeners>` block of `<listener>` elements, each gated by a reactive `r-if`. Auto-cleanup on destroy. |
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
- `ControlValueAccessor` auto-implemented for single-`model: true`
  components — your Rozie component is a real Angular form control
  (`[(ngModel)]` / `formControlName` bind directly)
- Standalone components, no NgModule
- `@for` / `@if` block syntax (not `*ngFor` / `*ngIf`)
- `Renderer2.listen` for `<listeners>` block
- Strict-templates clean (validated under `ngc --strictTemplates` for the
  reference + engine-wrapper examples)
- ChangeDetection: signal-driven, no zone.js round-trips for state updates

### Documented edges

A handful of small Angular-specific edges (custom modifier value-transforms
must be pure expressions; immediate `$watch` fires before `$onMount` on
Angular and Vue but after on the other targets; TypeScript 5.6+ required)
are described in [Cross-Framework Parity](/parity) and
[Compatibility](/compatibility).

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
