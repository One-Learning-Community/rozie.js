/**
 * Byte-offset source location. line/column are computed lazily from the
 * source string at diagnostic-render time (D-11). Always populate both
 * fields from the original .rozie file's absolute byte offsets.
 */
export interface SourceLoc {
  start: number;
  end: number;
}

/**
 * Output of the SFC block splitter (Plan 02). Each block carries the raw
 * content text, the absolute byte span of the content (between '>' of
 * opening tag and '<' of closing tag), and the absolute byte span of the
 * full block including its tags.
 */
export interface BlockEntry {
  content: string;
  contentLoc: SourceLoc;
  loc: SourceLoc;
}

export interface BlockMap {
  rozie?: { name: string; loc: SourceLoc };
  props?: BlockEntry;
  data?: BlockEntry;
  script?: BlockEntry;
  listeners?: BlockEntry;
  template?: BlockEntry;
  style?: BlockEntry;
}

/**
 * Top-level RozieAST shape. Per-block AST shapes (PropsAST, ScriptAST, etc.)
 * are filled in by Plans 03/04. Plan 01 only locks the wrapper shape so
 * downstream plans implement against a stable container.
 *
 * @experimental — shape may change before v1.0
 */
export interface RozieAST {
  type: 'RozieAST';
  name: string;
  loc: SourceLoc;
  props: PropsAST | null;
  data: DataAST | null;
  script: ScriptAST | null;
  listeners: ListenersAST | null;
  template: TemplateAST | null;
  style: StyleAST | null;
}

// Plan 03/04 fill these in. Plan 01 declares them as opaque markers so the
// RozieAST wrapper can be exported without circular blockers.
export interface PropsAST { type: 'PropsAST'; loc: SourceLoc; /* TODO Plan 03 */ }
export interface DataAST { type: 'DataAST'; loc: SourceLoc; /* TODO Plan 03 */ }
export interface ScriptAST { type: 'ScriptAST'; loc: SourceLoc; /* TODO Plan 03 */ }
export interface ListenersAST { type: 'ListenersAST'; loc: SourceLoc; /* TODO Plan 03/04 */ }
export interface TemplateAST { type: 'TemplateAST'; loc: SourceLoc; /* TODO Plan 03 */ }
export interface StyleAST { type: 'StyleAST'; loc: SourceLoc; /* TODO Plan 03 */ }
