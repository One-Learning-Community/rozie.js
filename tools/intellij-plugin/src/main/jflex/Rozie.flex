package js.rozie.intellij.lexer;

import com.intellij.lexer.FlexLexer;
import com.intellij.psi.tree.IElementType;
import static js.rozie.intellij.lexer.RozieTokenTypes.*;

/*
 * Rozie.flex — JFlex source for the .rozie host lexer.
 *
 * Architecture (Pitfall 9 — DO NOT re-implement HTML lexing inside template):
 *   - YYINITIAL handles top-level block boundaries: <rozie>, <template>, <script>,
 *     <props>, <data>, <listeners>, <style>, plus HTML comments and whitespace.
 *   - IN_BLOCK_OPEN_TAG scans attributes inside a block opening tag (e.g.,
 *     `lang="scss"`, `name="Counter"`) until `>`, then transitions to whichever
 *     block-body state was queued by the YYINITIAL rule that matched the open.
 *   - IN_<X>_BODY (one per block kind that holds *opaque* body text — script,
 *     props, data, listeners, style) consumes everything up to the matching
 *     close tag as a single body token. Body content is NOT tokenized further
 *     here — Plan 04's MultiHostInjector splits it.
 *   - IN_TEMPLATE_BODY is special: it scans for HTML tags, mustache `{{ }}`,
 *     and HTML comments; tag content surfaces Rozie carve-outs (r-*, @event,
 *     :prop, ref="..."). Bulk text between tags is emitted as TEMPLATE_BODY
 *     chunks for the HTML injector.
 *   - IN_TEMPLATE_TAG_OPEN tokenizes inside `<foo ...>` — emits R_DIRECTIVE,
 *     EVENT_AT/EVENT_NAME, PROP_COLON/PROP_NAME, REF_ATTR_NAME for Rozie carve
 *     outs; ATTR_NAME for plain HTML attrs; EQ; transitions into attribute
 *     value states on `"` / `'`.
 *   - IN_TEMPLATE_ATTR_VALUE_JS holds attribute values that Plan 04 will JS-
 *     inject (r-*, @, :, ref); $magic identifiers and {{ }} are surfaced.
 *   - IN_TEMPLATE_ATTR_VALUE_PLAIN holds plain HTML attribute values; mustache
 *     interpolation is also recognized here per CONTEXT D-09 ("we permit
 *     `{{ }}` in attribute values; Vue forbids").
 *   - IN_MUSTACHE handles `{{ ... }}`. $magic surfaces; rest is MUSTACHE_BODY.
 *   - IN_MODIFIER_CHAIN handles `@click.foo.bar` chains.
 *   - IN_MODIFIER_ARGS handles `(...)` after `.mod`, with paren-depth tracking
 *     so `.outside($refs.a, $refs.b).stop` works.
 *
 * Pitfall 4 (state leak) is handled by the FlexAdapter wrapping the generated
 * lexer; YYINITIAL is restored on every reset(...).
 */

%%

%public
%class _RozieLexer
%implements FlexLexer
%function advance
%type IElementType
%unicode

%state IN_BLOCK_OPEN_TAG
%state IN_BLOCK_ATTR_VALUE_DQ
%state IN_BLOCK_ATTR_VALUE_SQ
%state IN_LANG_ATTR_VALUE_DQ
%state IN_LANG_ATTR_VALUE_SQ

%state IN_SCRIPT_BODY
%state IN_PROPS_BODY
%state IN_DATA_BODY
%state IN_LISTENERS_BODY
%state IN_STYLE_BODY

%state IN_TEMPLATE_BODY
%state IN_TEMPLATE_TAG_OPEN
%state IN_TEMPLATE_TAG_CLOSE
%state IN_TEMPLATE_ATTR_VALUE_JS_DQ
%state IN_TEMPLATE_ATTR_VALUE_JS_SQ
%state IN_TEMPLATE_ATTR_VALUE_PLAIN_DQ
%state IN_TEMPLATE_ATTR_VALUE_PLAIN_SQ

%state IN_MUSTACHE
%state IN_MODIFIER_CHAIN
%state IN_MODIFIER_ARGS

%state IN_HTML_COMMENT

%{
  /**
   * Body state to enter when we hit `>` inside an IN_BLOCK_OPEN_TAG. Set by
   * the YYINITIAL rule that recognized the block opening tag.
   *
   * Default of `YYINITIAL` is a safe fallback for unrecognized opens (which
   * shouldn't happen, but guarantees we never wedge on weird input).
   */
  private int pendingBodyState = YYINITIAL;

  /**
   * Track `(` / `)` depth inside modifier args so `.outside($refs.a, $refs.b)`
   * doesn't terminate at the first `)`.
   */
  private int modifierArgsParenDepth = 0;

  /**
   * Stack one level of return-state for IN_MUSTACHE so we can pop back to the
   * right place — mustaches can appear in IN_TEMPLATE_BODY *or* in attribute
   * values per D-09. The stack size is one because we don't allow nested
   * mustaches; if they do nest we'd just emit BAD_CHARACTER.
   */
  private int mustacheReturnState = YYINITIAL;

  /**
   * In IN_MODIFIER_CHAIN, the first IDENT is the event name; subsequent IDENTs
   * (after `.`) are modifier names. Reset to true every time we enter the
   * chain from IN_TEMPLATE_TAG_OPEN via `@`.
   */
  private boolean modifierExpectingEventName = false;
%}

// ——— Macro definitions ———
WHITESPACE         = [\ \t\f]+
EOL                = \r|\n|\r\n
WS                 = ({WHITESPACE}|{EOL})+
IDENT              = [A-Za-z_][A-Za-z0-9_-]*
ATTR_IDENT         = [A-Za-z_][A-Za-z0-9_:.\-]*
MAGIC_IDENT_RE     = "$" ("props"|"data"|"refs"|"slots"|"emit"|"el"|"onMount"|"onUnmount"|"onUpdate"|"computed"|"watch")
R_DIRECTIVE_RE     = "r-" ("else-if"|"else"|"if"|"show"|"for"|"model"|"html"|"text"|"bind"|"on")

%%

// =====================================================================
// YYINITIAL — between top-level blocks (default state)
// =====================================================================
<YYINITIAL> {
  "<!--"                          { yybegin(IN_HTML_COMMENT); return HTML_COMMENT_OPEN; }

  "<rozie"                        { pendingBodyState = YYINITIAL;        yybegin(IN_BLOCK_OPEN_TAG); return ROZIE_BLOCK_TAG; }
  "<template"                     { pendingBodyState = IN_TEMPLATE_BODY; yybegin(IN_BLOCK_OPEN_TAG); return TEMPLATE_BLOCK_TAG; }
  "<script"                       { pendingBodyState = IN_SCRIPT_BODY;   yybegin(IN_BLOCK_OPEN_TAG); return SCRIPT_BLOCK_TAG; }
  "<props"                        { pendingBodyState = IN_PROPS_BODY;    yybegin(IN_BLOCK_OPEN_TAG); return PROPS_BLOCK_TAG; }
  "<data"                         { pendingBodyState = IN_DATA_BODY;     yybegin(IN_BLOCK_OPEN_TAG); return DATA_BLOCK_TAG; }
  "<listeners"                    { pendingBodyState = IN_LISTENERS_BODY;yybegin(IN_BLOCK_OPEN_TAG); return LISTENERS_BLOCK_TAG; }
  "<style"                        { pendingBodyState = IN_STYLE_BODY;    yybegin(IN_BLOCK_OPEN_TAG); return STYLE_BLOCK_TAG; }

  "</rozie>"                      { return ROZIE_CLOSE_TAG; }
  "</template>"                   { return TEMPLATE_CLOSE_TAG; }
  "</script>"                     { return SCRIPT_CLOSE_TAG; }
  "</props>"                      { return PROPS_CLOSE_TAG; }
  "</data>"                       { return DATA_CLOSE_TAG; }
  "</listeners>"                  { return LISTENERS_CLOSE_TAG; }
  "</style>"                      { return STYLE_CLOSE_TAG; }

  {WS}                            { return WHITE_SPACE; }
  [^]                             { return BAD_CHARACTER; }
}

// =====================================================================
// IN_BLOCK_OPEN_TAG — inside `<rozie ...>`, `<template ...>`, etc.
// =====================================================================
<IN_BLOCK_OPEN_TAG> {
  "lang"                          { return LANG_ATTR_NAME; }
  "="                             { return EQ; }

  // Lang attribute values get their own state so we can return LANG_ATTR_VALUE
  // (vs ATTR_VALUE_PLAIN). The opening quote is consumed as part of the value
  // state via lookbehind on the following rule.
  \" / [^\"]                      {
                                    // open dq for either lang or generic;
                                    // we can't tell from the quote alone, so
                                    // switch to a generic value state and let
                                    // the token kind disambiguate.
                                    yybegin(IN_BLOCK_ATTR_VALUE_DQ);
                                    return ATTR_VALUE_PLAIN; // partial; returned separately
                                  }
  // Simple cases: empty quoted strings, full quoted strings inline.
  \"[^\"]*\"                      { return ATTR_VALUE_PLAIN; }
  \'[^\']*\'                      { return ATTR_VALUE_PLAIN; }

  ">"                             {
                                    int next = pendingBodyState;
                                    pendingBodyState = YYINITIAL;
                                    yybegin(next);
                                    return GT;
                                  }
  "/>"                            {
                                    pendingBodyState = YYINITIAL;
                                    yybegin(YYINITIAL);
                                    return GT;
                                  }

  {ATTR_IDENT}                    { return ATTR_NAME; }
  {WS}                            { return WHITE_SPACE; }
  [^]                             { return BAD_CHARACTER; }
}

// IN_BLOCK_ATTR_VALUE_DQ / SQ are intentionally left as catch-all consumers so
// that the lookahead-based partial rule in IN_BLOCK_OPEN_TAG above never gets
// stuck. In practice the inline `"..."` and `'...'` rules above handle every
// real-world block-attribute value, but these states are kept defensively.
<IN_BLOCK_ATTR_VALUE_DQ> {
  \"                              { yybegin(IN_BLOCK_OPEN_TAG); return ATTR_VALUE_PLAIN; }
  [^\"]+                          { return ATTR_VALUE_PLAIN; }
}
<IN_BLOCK_ATTR_VALUE_SQ> {
  \'                              { yybegin(IN_BLOCK_OPEN_TAG); return ATTR_VALUE_PLAIN; }
  [^\']+                          { return ATTR_VALUE_PLAIN; }
}

// IN_LANG_ATTR_VALUE_* — currently unreachable (we return ATTR_VALUE_PLAIN for
// all block-attribute values today). Kept reserved for a future pass that
// distinguishes `lang=` values for SCSS/Less detection without re-parsing the
// token stream.
<IN_LANG_ATTR_VALUE_DQ> {
  \"                              { yybegin(IN_BLOCK_OPEN_TAG); return LANG_ATTR_VALUE; }
  [^\"]+                          { return LANG_ATTR_VALUE; }
}
<IN_LANG_ATTR_VALUE_SQ> {
  \'                              { yybegin(IN_BLOCK_OPEN_TAG); return LANG_ATTR_VALUE; }
  [^\']+                          { return LANG_ATTR_VALUE; }
}

// =====================================================================
// IN_HTML_COMMENT — inside `<!-- ... -->`
// =====================================================================
<IN_HTML_COMMENT> {
  "-->"                           { yybegin(YYINITIAL); return HTML_COMMENT_CLOSE; }
  // Greedy chunk: everything up to the next `-` (which might or might not be
  // the `-->` close). JFlex prefers longest match so the literal `-->` rule
  // above always wins when applicable.
  [^\-]+                          { return HTML_COMMENT_CONTENT; }
  "-"                             { return HTML_COMMENT_CONTENT; }
}

// =====================================================================
// IN_SCRIPT_BODY / IN_PROPS_BODY / IN_DATA_BODY / IN_LISTENERS_BODY
// Single-token greedy bodies up to matching close tag.
// =====================================================================
<IN_SCRIPT_BODY> {
  "</script>"                     { yybegin(YYINITIAL); return SCRIPT_CLOSE_TAG; }
  // Greedy: consume up to (but not including) the next "<" — JFlex's longest-
  // match rule then prefers `</script>` if it applies.
  [^<]+                           { return SCRIPT_BODY; }
  "<"                             { return SCRIPT_BODY; }
}
<IN_PROPS_BODY> {
  "</props>"                      { yybegin(YYINITIAL); return PROPS_CLOSE_TAG; }
  [^<]+                           { return PROPS_BODY; }
  "<"                             { return PROPS_BODY; }
}
<IN_DATA_BODY> {
  "</data>"                       { yybegin(YYINITIAL); return DATA_CLOSE_TAG; }
  [^<]+                           { return DATA_BODY; }
  "<"                             { return DATA_BODY; }
}
<IN_LISTENERS_BODY> {
  "</listeners>"                  { yybegin(YYINITIAL); return LISTENERS_CLOSE_TAG; }
  [^<]+                           { return LISTENERS_BODY; }
  "<"                             { return LISTENERS_BODY; }
}
<IN_STYLE_BODY> {
  "</style>"                      { yybegin(YYINITIAL); return STYLE_CLOSE_TAG; }
  [^<]+                           { return STYLE_BODY; }
  "<"                             { return STYLE_BODY; }
}

// =====================================================================
// IN_TEMPLATE_BODY — inside <template> ... </template>
// Looks for HTML tags, comments, mustaches; everything else is opaque body text.
// =====================================================================
<IN_TEMPLATE_BODY> {
  "</template>"                   { yybegin(YYINITIAL); return TEMPLATE_CLOSE_TAG; }
  "<!--"                          { yybegin(IN_HTML_COMMENT); return HTML_COMMENT_OPEN; }
  "{{"                            { mustacheReturnState = IN_TEMPLATE_BODY; yybegin(IN_MUSTACHE); return MUSTACHE_OPEN; }
  "</"                            { yybegin(IN_TEMPLATE_TAG_CLOSE); return LT_SLASH; }
  "<"                             { yybegin(IN_TEMPLATE_TAG_OPEN); return TEMPLATE_BODY; }
  // Body chunk: stop at any of the interesting starters above. JFlex prefers
  // the longer match, so the multi-char literals above win when applicable.
  [^<{]+                          { return TEMPLATE_BODY; }
  "{"                             { return TEMPLATE_BODY; }
}

// =====================================================================
// IN_TEMPLATE_TAG_OPEN — inside `<foo ...` (unclosed opening tag)
// =====================================================================
<IN_TEMPLATE_TAG_OPEN> {
  ">"                             { yybegin(IN_TEMPLATE_BODY); return GT; }
  "/>"                            { yybegin(IN_TEMPLATE_BODY); return GT; }

  {R_DIRECTIVE_RE}                { return R_DIRECTIVE; }

  "@" / {IDENT}                   { modifierExpectingEventName = true; yybegin(IN_MODIFIER_CHAIN); return EVENT_AT; }
  // Defensive — bare @ should still produce a usable token stream.
  "@"                             { return EVENT_AT; }

  ":" / {IDENT}                   { return PROP_COLON; }
  ":"                             { return BAD_CHARACTER; }

  "ref"                           { return REF_ATTR_NAME; }

  "="                             { return EQ; }

  // Attribute values. The host lexer cannot statically know whether the
  // *previous* attribute name was a Rozie carve-out or a plain HTML attr, so
  // we emit ATTR_VALUE_JS for every quoted value here. Plan 04's injector then
  // checks the preceding non-whitespace token to decide whether to JS-inject
  // (carve-out) or HTML-inject (plain attr — which means no JS injection at
  // all in v1; HTML injection covers it via TEMPLATE_BODY ranges).
  //
  // Rationale: the whole-template HTML injection per D-10 already handles
  // plain attributes correctly. We only need ATTR_VALUE_JS to *exist* as a
  // distinct token kind so Plan 04 has something to JS-inject when the
  // preceding attr name was r-*, @, :, or ref.
  \"                              { yybegin(IN_TEMPLATE_ATTR_VALUE_JS_DQ); return ATTR_VALUE_JS; }
  \'                              { yybegin(IN_TEMPLATE_ATTR_VALUE_JS_SQ); return ATTR_VALUE_JS; }

  // Plain attribute name OR tag name. JFlex falls through to this when the
  // R_DIRECTIVE / @ / : / ref / quote rules above don't apply. This includes
  // the tag name itself (the leading `<foo`'s `foo` portion). It also handles
  // the `x` after a `:` prop-binding when JFlex resumes scanning the tag-open
  // state — we *could* split off PROP_NAME here, but ATTR_IDENT subsumes IDENT
  // (every IDENT is a valid ATTR_IDENT), so a separate IDENT rule would never
  // match. Plan 03 colors the post-`:` ATTR_NAME via the highlighter's awareness
  // of the immediately-preceding PROP_COLON token instead.

  {ATTR_IDENT}                    { return ATTR_NAME; }

  {WS}                            { return WHITE_SPACE; }
  [^]                             { return BAD_CHARACTER; }
}

// =====================================================================
// IN_TEMPLATE_TAG_CLOSE — inside `</foo>`
// =====================================================================
<IN_TEMPLATE_TAG_CLOSE> {
  ">"                             { yybegin(IN_TEMPLATE_BODY); return GT; }
  {ATTR_IDENT}                    { return ATTR_NAME; }
  {WS}                            { return WHITE_SPACE; }
  [^]                             { return BAD_CHARACTER; }
}

// =====================================================================
// IN_TEMPLATE_ATTR_VALUE_JS_DQ / SQ — value of r-*/@/:/ref/plain attrs in template
// $magic identifiers and {{ }} mustaches surface; rest is ATTR_VALUE_JS.
// =====================================================================
<IN_TEMPLATE_ATTR_VALUE_JS_DQ> {
  \"                              { yybegin(IN_TEMPLATE_TAG_OPEN); return ATTR_VALUE_JS; }
  "{{"                            { mustacheReturnState = IN_TEMPLATE_ATTR_VALUE_JS_DQ; yybegin(IN_MUSTACHE); return MUSTACHE_OPEN; }
  {MAGIC_IDENT_RE}                { return MAGIC_IDENT; }
  [^\"{$]+                        { return ATTR_VALUE_JS; }
  "{"                             { return ATTR_VALUE_JS; }
  "$"                             { return ATTR_VALUE_JS; }
}
<IN_TEMPLATE_ATTR_VALUE_JS_SQ> {
  \'                              { yybegin(IN_TEMPLATE_TAG_OPEN); return ATTR_VALUE_JS; }
  "{{"                            { mustacheReturnState = IN_TEMPLATE_ATTR_VALUE_JS_SQ; yybegin(IN_MUSTACHE); return MUSTACHE_OPEN; }
  {MAGIC_IDENT_RE}                { return MAGIC_IDENT; }
  [^\'{$]+                        { return ATTR_VALUE_JS; }
  "{"                             { return ATTR_VALUE_JS; }
  "$"                             { return ATTR_VALUE_JS; }
}

// IN_TEMPLATE_ATTR_VALUE_PLAIN_* — reserved for a future pass that distinguishes
// plain HTML attribute values from JS-injected ones. Today every quoted attr
// value in IN_TEMPLATE_TAG_OPEN routes through the JS state; if Plan 04 needs
// the distinction it can be added by the IN_TEMPLATE_TAG_OPEN rules above.
<IN_TEMPLATE_ATTR_VALUE_PLAIN_DQ> {
  \"                              { yybegin(IN_TEMPLATE_TAG_OPEN); return ATTR_VALUE_PLAIN; }
  "{{"                            { mustacheReturnState = IN_TEMPLATE_ATTR_VALUE_PLAIN_DQ; yybegin(IN_MUSTACHE); return MUSTACHE_OPEN; }
  [^\"{]+                         { return ATTR_VALUE_PLAIN; }
  "{"                             { return ATTR_VALUE_PLAIN; }
}
<IN_TEMPLATE_ATTR_VALUE_PLAIN_SQ> {
  \'                              { yybegin(IN_TEMPLATE_TAG_OPEN); return ATTR_VALUE_PLAIN; }
  "{{"                            { mustacheReturnState = IN_TEMPLATE_ATTR_VALUE_PLAIN_SQ; yybegin(IN_MUSTACHE); return MUSTACHE_OPEN; }
  [^\'{]+                         { return ATTR_VALUE_PLAIN; }
  "{"                             { return ATTR_VALUE_PLAIN; }
}

// =====================================================================
// IN_MUSTACHE — inside `{{ ... }}`. Surfaces $magic; rest is opaque body.
// =====================================================================
<IN_MUSTACHE> {
  "}}"                            { yybegin(mustacheReturnState); return MUSTACHE_CLOSE; }
  {MAGIC_IDENT_RE}                { return MAGIC_IDENT; }
  [^}$]+                          { return MUSTACHE_BODY; }
  "}"                             { return MUSTACHE_BODY; }
  "$"                             { return MUSTACHE_BODY; }
}

// =====================================================================
// IN_MODIFIER_CHAIN — after `@event`, looking for `.mod.mod`
// First emits the EVENT_NAME (or a sequence of MODIFIER_NAME after each `.`),
// then alternates DOT / NAME / LPAREN. Exits cleanly back to
// IN_TEMPLATE_TAG_OPEN when the chain ends — typically at `=`, `"`, `'`, `>`,
// `/>`, or whitespace; we rewind one character and let the tag-open state
// re-tokenize it.
// =====================================================================
<IN_MODIFIER_CHAIN> {
  // After `.` we expect a modifier name; after `@` we expect the event name.
  // JFlex's longest-match rule means IDENT wins over the catch-all exit below
  // when we're sitting on identifier characters. The two callers (EVENT_AT
  // setup vs MODIFIER_DOT setup) emit EVENT_NAME or MODIFIER_NAME respectively.
  // Disambiguating which one to return without explicit %{ %} state would
  // require splitting the state in two; since downstream consumers (Plan 03
  // highlighter) treat both EVENT_NAME and MODIFIER_NAME with the same
  // attribute kind family, we collapse them into MODIFIER_NAME except for
  // the very first IDENT (event name). We track this via a flag set in %{ %}.
  {IDENT}                         {
                                    if (modifierExpectingEventName) {
                                      modifierExpectingEventName = false;
                                      return EVENT_NAME;
                                    }
                                    return MODIFIER_NAME;
                                  }
  "."                             { return MODIFIER_DOT; }
  "("                             { modifierArgsParenDepth = 1; yybegin(IN_MODIFIER_ARGS); return MODIFIER_LPAREN; }
  {WS}                            { yybegin(IN_TEMPLATE_TAG_OPEN); return WHITE_SPACE; }

  // Explicit chain terminators — consume the character and emit the same
  // token IN_TEMPLATE_TAG_OPEN would have, while transitioning state.
  // Avoids zero-width-token issues that yypushback would create.
  "="                             { yybegin(IN_TEMPLATE_TAG_OPEN); return EQ; }
  \"                              { yybegin(IN_TEMPLATE_ATTR_VALUE_JS_DQ); return ATTR_VALUE_JS; }
  \'                              { yybegin(IN_TEMPLATE_ATTR_VALUE_JS_SQ); return ATTR_VALUE_JS; }
  ">"                             { yybegin(IN_TEMPLATE_BODY); return GT; }
  "/>"                            { yybegin(IN_TEMPLATE_BODY); return GT; }

  // Catch-all for genuinely unexpected input (e.g., a stray punctuator
  // mid-chain). Consume one character to keep advancing — emitting
  // BAD_CHARACTER signals "the lexer recognized this is wrong".
  [^]                             { yybegin(IN_TEMPLATE_TAG_OPEN); return BAD_CHARACTER; }
}

// =====================================================================
// IN_MODIFIER_ARGS — inside `(...)` of `.mod(args)` with paren-depth tracking
// =====================================================================
<IN_MODIFIER_ARGS> {
  "("                             { modifierArgsParenDepth++; return MODIFIER_ARGS; }
  ")"                             {
                                    modifierArgsParenDepth--;
                                    if (modifierArgsParenDepth <= 0) {
                                      modifierArgsParenDepth = 0;
                                      yybegin(IN_MODIFIER_CHAIN);
                                      return MODIFIER_RPAREN;
                                    }
                                    return MODIFIER_ARGS;
                                  }
  // Greedy chunk; JFlex prefers the literal "(" / ")" rules above when applicable.
  [^()]+                          { return MODIFIER_ARGS; }
}
