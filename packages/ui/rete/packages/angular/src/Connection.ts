import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject, input } from '@angular/core';

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-connection',
  standalone: true,
  template: `

  `,
})
export class Connection {
  id = input<string>(undefined);
  source = input.required<string>();
  sourceOutput = input<string>(undefined);
  target = input.required<string>();
  targetInput = input<string>(undefined);
  canvas = inject(rozieToken('rete:canvas'));
  private __rozieDestroyRef = inject(DestroyRef);

  constructor() {
    this.cv = this.canvas;

    // Effective edge id: explicit prop wins, else the source:out->target:in default
    // (mirrors reconcileConnections so collision dedup is consistent).
    effect(() => () => {
      if (this.registered) return;
      const live = this.canvas;
      if (live == null) return;
      this.cv = live;
      if (this.connId == null) this.connId = this.edgeId();
      this.registered = true;
      this.cv.registerConnection(this.connId, this.buildConn());
    });
  }

  ngAfterViewInit() {
    this.connId = this.edgeId();
    // On Lit the injected canvas may still be undefined here (async context, REQ-30);
    // the $onUpdate below registers once it resolves.
    // On Lit the injected canvas may still be undefined here (async context, REQ-30);
    // the $onUpdate below registers once it resolves.
    if (this.cv && !this.registered) {
      this.registered = true;
      this.cv.registerConnection(this.connId, this.buildConn());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.cv) this.cv.unregisterConnection(this.connId);
    });
  }

  cv: any = null;
  edgeId = () => {
    const __id = this.id();
    const __sourceOutput = this.sourceOutput();
    const __targetInput = this.targetInput();
    if (__id != null) return __id;
    const srcOut = __sourceOutput != null ? __sourceOutput : 'out';
    const tgtIn = __targetInput != null ? __targetInput : 'in';
    return `${this.source()}:${srcOut}->${this.target()}:${tgtIn}`;
  };
  connId: any = null;
  registered = false;
  buildConn = () => ({
    id: this.connId,
    source: this.source(),
    sourceOutput: this.sourceOutput(),
    target: this.target(),
    targetInput: this.targetInput()
  });
}

export default Connection;
