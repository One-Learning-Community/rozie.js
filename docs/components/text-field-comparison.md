---
surface_hash: e4fd7782a756
---

# TextField vs the per-framework alternatives

Binding a native `<input>` is the easy part, and every framework already does it well. The part that gets rebuilt once per framework is the field around it: a label tied to the control, help and error text tied through `aria-describedby`, an `aria-invalid` state, unique ids per instance, form-library integration, and (for a textarea) growing with its content. `TextField` is that field, with the same API and behaviour on all six frameworks.

## What it replaces per framework

| You were reaching for | `TextField` instead |
| --- | --- |
| **React** — a hand-rolled `Field` component with `useId()` for the label/description/error ids, `react-textarea-autosize`, or MUI `TextField` / Chakra `FormControl` + `Input` | One `<TextField>` with `modelValue` / `onModelValueChange`, typed `onChange` / `onEnter` payloads, a typed `TextFieldHandle`, and the `--rozie-text-field-*` skin. |
| **Vue** — a custom `v-model` input wrapper, Vuetify `v-text-field` / `v-textarea` (`auto-grow`), or PrimeVue `InputText` + `FloatLabel` + `Message` | `<TextField v-model:modelValue="email" label="Email" :error="err" />` — idiomatic `v-model`, `@change`, `@enter`, and a template-ref handle. |
| **Svelte** — a `bind:value` input plus manual `id` / `aria-describedby` wiring, or `bits-ui` `Label` + a plain input | `<TextField bind:modelValue={email} label="Email" {error} />` with Svelte 5 runes; `bind:this` for the handle. |
| **Angular** — Material `mat-form-field` + `matInput` + `mat-error`, or a custom `ControlValueAccessor` directive | `<TextField [formControl]="email" label="Email" [error]="msg" />` — a `ControlValueAccessor` out of the box, no `mat-form-field` theming tie-in. |
| **Solid** — `@kobalte/core` `TextField` (Label / Description / ErrorMessage parts), or a `createSignal` input | `<TextField modelValue={email()} onModelValueChange={setEmail} label="Email" />` with a ref-callback handle. |
| **Lit** — Shoelace / Web Awesome `sl-input`, Material `md-outlined-text-field`, or a hand-written element | `<rozie-text-field>` with reactive properties and `model-value-change` / `change` / `enter` events. |

## What you get

- **Label, description and error wired for you** — `<label for>`, `aria-describedby` (description → error → counter, only what is rendered), and `aria-invalid`.
- **Unique ids per instance**, or stable ones through `idBase`.
- **Angular `ControlValueAccessor`** from the single `model: true` prop: `[formControl]`, `[(ngModel)]`, touched on focus-out, and form-level disable.
- **Textarea autosize** between `rows` and `maxRows`, re-measured on input, on programmatic writes and when the field width changes.
- **A character counter** against `maxLength`, linked as a description rather than a noisy live region.
- **`prefix` / `suffix` slots** inside the bordered control box.
- **Token theming** — the same `--rozie-text-field-*` variables and the shadcn / Material / Bootstrap bridges on every framework.

## What it does not do

- **It does not wrap a control you bring.** On Lit the field lives in a shadow root, and id references do not cross a shadow boundary, so a generic `<Field>` around a slotted input could not label it on that target. Other `@rozie-ui` controls ([NumberField](/components/number-field), [Select](/components/select), [Combobox](/components/combobox)) take their own `ariaLabel`.
- **It does not validate.** Validation stays in your form library (Angular forms, VeeValidate, React Hook Form, Felte, Zod…); pass the resulting message to `error`.
- **No floating label.** The label sits above the control on every theme, including the Material bridge.
- **On Lit the inner control does not join an outer `<form>`.** Read `modelValue` on submit.
