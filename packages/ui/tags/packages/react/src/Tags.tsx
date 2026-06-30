import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Tags.css';

interface TagCtx { tag: any; index: any; remove: any; }

interface TagsProps {
  /**
   * The committed tokens — `model: true`, so a commit/remove/paste writes a **fresh** array back through `r-model:modelValue` (uncontrolled fallback `[]`). Because it is the sole model prop, the Angular output is a `ControlValueAccessor` (`[formControl]` / `[(ngModel)]` bind directly).
   * @example
   * <Tags r-model:modelValue="skills" placeholder="Add a skill…" />
   */
  modelValue?: any[];
  defaultModelValue?: any[];
  onModelValueChange?: (modelValue: any[]) => void;
  /**
   * The keys that commit the current draft as a token (matched against the key event's `key`). Default `[',', 'Enter']`. Non-`'Enter'` entries also act as the split characters when pasting bulk text. Use e.g. `[' ', 'Enter']` for a space-delimited input.
   */
  delimiters?: any[];
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
  validate?: ((...args: any[]) => any) | null;
  /**
   * Placeholder text for the inline text input (e.g. `"Add a tag…"`).
   */
  placeholder?: string;
  /**
   * Accessible name for the whole control (`role="group"`). The inline text input is labelled with the same name so assistive tech announces what is being entered. A visually-hidden live region announces the current token count on change.
   */
  ariaLabel?: (string) | null;
  onChange?: (...args: any[]) => void;
  onAdd?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  renderTag?: (ctx: TagCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface TagsHandle {
  clear: (...args: any[]) => any;
  focus: (...args: any[]) => any;
}

const Tags = forwardRef<TagsHandle, TagsProps>(function Tags(_props: TagsProps, ref): JSX.Element {
  const __defaultDelimiters = useState(() => (() => [',', 'Enter'])())[0];
  const props: Omit<TagsProps, 'delimiters' | 'allowDuplicates' | 'max' | 'disabled' | 'readonly' | 'validate' | 'placeholder' | 'ariaLabel'> & { delimiters: any[]; allowDuplicates: boolean; max: (number) | null; disabled: boolean; readonly: boolean; validate: ((...args: any[]) => any) | null; placeholder: string; ariaLabel: (string) | null } = {
    ..._props,
    delimiters: _props.delimiters ?? __defaultDelimiters,
    allowDuplicates: _props.allowDuplicates ?? false,
    max: _props.max ?? null,
    disabled: _props.disabled ?? false,
    readonly: _props.readonly ?? false,
    validate: _props.validate ?? null,
    placeholder: _props.placeholder ?? '',
    ariaLabel: _props.ariaLabel ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { modelValue, delimiters, allowDuplicates, max, disabled, readonly, validate, placeholder, ariaLabel, defaultValue, onModelValueChange, defaultModelValue, ...rest } = _props as TagsProps & Record<string, unknown>;
    void modelValue; void delimiters; void allowDuplicates; void max; void disabled; void readonly; void validate; void placeholder; void ariaLabel; void defaultValue; void onModelValueChange; void defaultModelValue;
    return rest;
  })();
  const [modelValue, setModelValue] = useControllableState({
    value: props.modelValue,
    defaultValue: props.defaultModelValue ?? (() => [])(),
    onValueChange: props.onModelValueChange,
  });
  const [draft, setDraft] = useState('');
  const root = useRef<HTMLDivElement | null>(null);

  const tokens = useCallback(() => Array.isArray(modelValue) ? modelValue : [], [modelValue]);
  function commitKeys() {
    return Array.isArray(props.delimiters) ? props.delimiters : [',', 'Enter'];
  }
  function splitChars() {
    return commitKeys().filter((k: any) => k !== 'Enter');
  }
  function atMax() {
    return typeof props.max === 'number' && tokens().length >= props.max;
  }
  function canEdit() {
    return !props.disabled && !props.readonly;
  }
  function commitTokens(next: any) {
    setModelValue(next);
    props.onChange && props.onChange({
      value: next
    });
  }
  function addToken(raw: any) {
    if (!canEdit()) return false;
    let candidate = String(raw == null ? '' : raw).trim();
    if (!candidate) return false;
    if (typeof props.validate === 'function') {
      const result = props.validate(candidate, tokens());
      if (!result) return false;
      candidate = String(result);
      if (!candidate) return false;
    }
    const cur = tokens();
    if (!props.allowDuplicates && cur.indexOf(candidate) !== -1) return false;
    if (typeof props.max === 'number' && cur.length >= props.max) return false;
    const next = cur.concat([candidate]);
    commitTokens(next);
    props.onAdd && props.onAdd({
      value: candidate,
      tokens: next
    });
    return true;
  }
  const { onRemove: _rozieProp_onRemove } = props;
    const removeAt = useCallback((idx: any) => {
    if (!canEdit()) return;
    const cur = tokens();
    if (idx < 0 || idx >= cur.length) return;
    const removed = cur[idx];
    const next = cur.slice(0, idx).concat(cur.slice(idx + 1));
    commitTokens(next);
    _rozieProp_onRemove && _rozieProp_onRemove({
      value: removed,
      index: idx,
      tokens: next
    });
  }, [_rozieProp_onRemove, canEdit, commitTokens, tokens]);
  function focusTheInput() {
    const root$local = root.current;
    if (!root$local) return;
    const el = root$local.querySelector('input');
    if (el) el.focus();
  }
  const onInput = useCallback((e: any) => {
    setDraft(e && e.target ? e.target.value : '');
  }, []);
  const onKeydown = useCallback((e: any) => {
    if (!canEdit()) return;
    const key = e ? e.key : '';
    const value = e && e.target ? e.target.value : '';
    if (commitKeys().indexOf(key) !== -1) {
      if (e) e.preventDefault();
      if (addToken(value)) setDraft('');
      return;
    }
    if (key === 'Backspace' && value === '') {
      const cur = tokens();
      if (cur.length > 0) {
        if (e) e.preventDefault();
        removeAt(cur.length - 1);
      }
    }
  }, [addToken, canEdit, commitKeys, removeAt, tokens]);
  const onBlur = useCallback((e: any) => {
    if (!canEdit()) return;
    const value = e && e.target ? e.target.value : '';
    if (value && addToken(value)) setDraft('');
  }, [addToken, canEdit]);
  const onPaste = useCallback((e: any) => {
    if (!canEdit()) return;
    const text = e && e.clipboardData && e.clipboardData.getData('text') || '';
    const seps = splitChars();
    let parts = [text];
    if (seps.length) {
      // Split on every separator char in turn.
      for (let s = 0; s < seps.length; s++) {
        const sep = seps[s];
        const out = [];
        for (let p = 0; p < parts.length; p++) {
          const pieces = String(parts[p]).split(sep);
          for (let q = 0; q < pieces.length; q++) out.push(pieces[q]);
        }
        parts = out;
      }
    }
    const trimmed = parts.map((p: any) => String(p).trim()).filter((p: any) => p.length > 0);
    if (trimmed.length <= 1 && seps.length === 0) return; // let the input handle a plain paste
    if (e) e.preventDefault();
    let addedAny = false;
    for (let i = 0; i < trimmed.length; i++) {
      if (addToken(trimmed[i])) addedAny = true;
    }
    if (addedAny) setDraft('');
  }, [addToken, canEdit, splitChars]);
  function removeLabel(t: any) {
    return 'Remove ' + String(t);
  }
  function countLabel() {
    const n = tokens().length;
    return n === 1 ? '1 tag' : n + ' tags';
  }
  function clear() {
    commitTokens([]);
    setDraft('');
    focusTheInput();
  }
  function focus() {
    return focusTheInput();
  }

  const _rozieExposeRef = useRef({ clear, focus });
  _rozieExposeRef.current = { clear, focus };
  useImperativeHandle(ref, () => ({ clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args), focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args) }), []);

  return (
    <>
    <div ref={root} role="group" aria-label={rozieAttr(props.ariaLabel)} {...attrs} className={clsx(clsx("rozie-tags", { "rozie-tags--disabled": props.disabled, "rozie-tags--readonly": props.readonly }), (attrs.className as string | undefined))} data-rozie-s-64848f8e="">
      <ul className={"rozie-tags-list"} data-rozie-s-64848f8e="">
        {tokens().map((t) => <li key={t + ':' + tokens().indexOf(t)} className={"rozie-tags-chip"} data-rozie-s-64848f8e="">
          {(props.renderTag ?? props.slots?.['tag']) ? ((props.renderTag ?? props.slots?.['tag']) as Function)({ tag: t, index: tokens().indexOf(t), remove: () => removeAt(tokens().indexOf(t)) }) : <><span className={"rozie-tags-chip__label"} data-rozie-s-64848f8e="">{rozieDisplay(t)}</span>{(!props.readonly) && <button type="button" className={"rozie-tags-chip__remove"} disabled={!!props.disabled} aria-label={rozieAttr(removeLabel(t))} onClick={($event) => { removeAt(tokens().indexOf(t)); }} data-rozie-s-64848f8e="">×</button>}</>}
        </li>)}
      </ul>

      {(!props.readonly) && <input className={"rozie-tags-input"} type="text" autoComplete="off" autoCapitalize="off" value={draft} placeholder={props.placeholder} disabled={!!props.disabled || !!atMax()} aria-label={rozieAttr(props.ariaLabel)} aria-disabled={!!props.disabled} onInput={($event) => { onInput($event); }} onKeyDown={($event) => { onKeydown($event); }} onPaste={($event) => { onPaste($event); }} onBlur={($event) => { onBlur($event); }} data-rozie-s-64848f8e="" />}<span className={"rozie-tags-count"} aria-live="polite" data-rozie-s-64848f8e="">{rozieDisplay(countLabel())}</span>
    </div>
    </>
  );
});
export default Tags;
