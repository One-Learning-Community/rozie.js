declare const isSafeKey: (k: any) => boolean;
declare const wrapAggregationFn: (fn: any) => string | ((columnId: any, leafRows: any, childRows: any) => any);
declare const collectNestedDefs: (list: any, out: any) => void;
declare const indexDefsById: (defs: any) => any;
declare const collectGroupableLeafDefs: (defs: any) => any[];
declare const EDITOR_KINDS: string[];
declare const editorKindWarning: (id: any, editor: any) => string | null;
declare const columnSpecsEquivalent: (a: any, b: any, depth?: number) => boolean;
export { isSafeKey, wrapAggregationFn, collectNestedDefs, indexDefsById, collectGroupableLeafDefs, EDITOR_KINDS, editorKindWarning, columnSpecsEquivalent };
