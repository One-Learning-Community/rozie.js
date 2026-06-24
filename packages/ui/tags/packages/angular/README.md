# @rozie-ui/tags-angular

Idiomatic **angular** `Tags` — a headless, fully-accessible (WAI-ARIA) tags / token input (removable chips, type-to-add with configurable delimiters, paste-to-bulk-add, dedup, per-token validation, a `max` cap, and a scoped `#tag` slot for custom chip rendering) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native `<input>` plus the platform clipboard/keyboard; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/tags-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { Tags } from '@rozie-ui/tags-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Tags],
  template: `
    <Tags
      [(modelValue)]="skills"
      placeholder="Add a skill…"
      ariaLabel="Skills"
      [max]="8"
      (add)="onAdd($event)"
    />
  `,
})
export class DemoComponent {
  skills = ['rozie', 'angular'];
  onAdd(e: { value: string; tokens: string[] }) {
    console.log('added', e.value);
  }
}
```

## Theming

Every visual value is a `--rozie-tags-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/tags-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `modelValue` model prop is the control value, so a tags input **is** a form control. It binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Tags } from '@rozie-ui/tags-angular';

@Component({
  selector: 'app-tags-form',
  standalone: true,
  imports: [Tags, ReactiveFormsModule],
  template: `
    <!-- The tokens array IS the form control value -->
    <Tags [formControl]="skills" ariaLabel="Skills" [max]="8" />
  `,
})
export class TagsFormComponent {
  skills = new FormControl<string[]>(['rozie']);
}

// Template-driven forms work the same way:
//   <Tags [(ngModel)]="skills" name="skills" />
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `modelValue` | `Array` | `[]` | ✓ |  | The committed tokens — `model: true`, so a commit/remove/paste writes a **fresh** array back through `r-model:modelValue` (uncontrolled fallback `[]`). Because it is the sole model prop, the Angular output is a `ControlValueAccessor` (`[formControl]` / `[(ngModel)]` bind directly). |
| `delimiters` | `Array` | `[…]` |  |  | The keys that commit the current draft as a token (matched against the key event's `key`). Default `[',', 'Enter']`. Non-`'Enter'` entries also act as the split characters when pasting bulk text. Use e.g. `[' ', 'Enter']` for a space-delimited input. |
| `allowDuplicates` | `Boolean` | `false` |  |  | Allow the same token value to be added more than once. Defaults to `false` — a candidate equal (case-sensitive) to an existing token is silently rejected on commit. Set `true` to permit duplicates. |
| `max` | `Number` | `null` |  |  | Maximum number of tokens. Once the list reaches `max`, the input is disabled and further adds (type, paste, programmatic) are rejected. `null` (the default) means unlimited. |
| `disabled` | `Boolean` | `false` |  |  | Disable the whole control — the text input is disabled, every remove button is disabled, and no token can be added or removed. Also sets the Angular CVA disabled state. |
| `readonly` | `Boolean` | `false` |  |  | Render the tokens read-only — they remain visible but cannot be added or removed, and the text input is hidden. Unlike `disabled` it carries no disabled styling, so it reads as a display of committed values. |
| `validate` | `Function` | `null` |  |  | Optional per-token validator / normalizer. Called with `(candidate, tokens)` for each commit; return a (possibly normalized) **string** to accept it, or a falsy value (`false` / `null` / `""`) to reject the candidate. Runs before the dedup + `max` checks. Example: `v => /^\S+@\S+$/.test(v) ? v.toLowerCase() : false` for emails. |
| `placeholder` | `String` | `''` |  |  | Placeholder text for the inline text input (e.g. `"Add a tag…"`). |
| `ariaLabel` | `String` | `null` |  |  | Accessible name for the whole control (`role="group"`). The inline text input is labelled with the same name so assistive tech announces what is being entered. A visually-hidden live region announces the current token count on change. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired on every committed-list mutation (add, remove, paste-bulk-add, or a programmatic `clear`). Payload `{ value }` — the new full tokens array. Use it to observe the list without two-way binding. |
| `add` | Fired when a token is committed (an accepted Enter/comma/paste add). Payload `{ value, tokens }` — `value` is the newly added token string, `tokens` the fresh full array. Rejected candidates (duplicate, failed `validate`, over `max`) do NOT fire it. |
| `remove` | Fired when a token is removed (a chip remove-button click or Backspace in an empty input). Payload `{ value, index, tokens }` — the removed token, its former index, and the fresh full array. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `clear` | Remove every token (emits `change` with `{ value: [] }`) and move DOM focus to the text input. Collision-safe — not a host-element member. |
| `focus` | Move DOM focus to the inline text input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is the intended semantics. |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Tags) tags!: Tags;   // or the viewChild() signal
  focusIt() { this.tags.focus(); }
  clearIt() { this.tags.clear(); }
}
```

## Slots

| Slot | Params |
| --- | --- |
| tag | tag, index, remove |

The scoped `tag` slot lets you fully replace each chip; its params are `{ tag, index, remove }` (the token string, its index, and a zero-arg `remove()` for that token). On React the slot is a render-prop `children` callback (the documented cross-framework slot divergence).
