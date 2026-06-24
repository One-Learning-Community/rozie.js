import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface TagsProps {
  /**
   * The committed tokens — `model: true`, so a commit/remove/paste writes a **fresh** array back through `r-model:modelValue` (uncontrolled fallback `[]`). Because it is the sole model prop, the Angular output is a `ControlValueAccessor` (`[formControl]` / `[(ngModel)]` bind directly).
   * @example
   * <Tags r-model:modelValue="skills" placeholder="Add a skill…" />
   */
  modelValue?: unknown[];
  defaultModelValue?: unknown[];
  onModelValueChange?: (next: unknown[]) => void;
  /**
   * The keys that commit the current draft as a token (matched against the key event's `key`). Default `[',', 'Enter']`. Non-`'Enter'` entries also act as the split characters when pasting bulk text. Use e.g. `[' ', 'Enter']` for a space-delimited input.
   */
  delimiters?: unknown[];
  /**
   * Allow the same token value to be added more than once. Defaults to `false` — a candidate equal (case-sensitive) to an existing token is silently rejected on commit. Set `true` to permit duplicates.
   */
  allowDuplicates?: boolean;
  /**
   * Maximum number of tokens. Once the list reaches `max`, the input is disabled and further adds (type, paste, programmatic) are rejected. `null` (the default) means unlimited.
   */
  max?: (number) | null;
  /**
   * Disable the whole control — the text input is disabled, every remove button is disabled, and no token can be added or removed. Also sets the Angular CVA disabled state.
   */
  disabled?: boolean;
  /**
   * Render the tokens read-only — they remain visible but cannot be added or removed, and the text input is hidden. Unlike `disabled` it carries no disabled styling, so it reads as a display of committed values.
   */
  readonly?: boolean;
  /**
   * Optional per-token validator / normalizer. Called with `(candidate, tokens)` for each commit; return a (possibly normalized) **string** to accept it, or a falsy value (`false` / `null` / `""`) to reject the candidate. Runs before the dedup + `max` checks. Example: `v => /^\S+@\S+$/.test(v) ? v.toLowerCase() : false` for emails.
   * @example
   * validate: (v) => (v.length >= 2 ? v.trim() : false)
   */
  validate?: ((...args: unknown[]) => unknown) | null;
  /**
   * Placeholder text for the inline text input (e.g. `"Add a tag…"`).
   */
  placeholder?: string;
  /**
   * Accessible name for the whole control (`role="group"`). The inline text input is labelled with the same name so assistive tech announces what is being entered. A visually-hidden live region announces the current token count on change.
   */
  ariaLabel?: (string) | null;
  onChange?: (...args: unknown[]) => void;
  onAdd?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  renderTag?: (params: { tag: () => void; index: unknown; remove: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface TagsHandle {
  clear: (...args: any[]) => any;
  focus: (...args: any[]) => any;
}

declare const Tags: React.ForwardRefExoticComponent<TagsProps & React.RefAttributes<TagsHandle>>;
export default Tags;
