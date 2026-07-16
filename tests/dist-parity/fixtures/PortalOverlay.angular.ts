import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface DefaultCtx {}

@Component({
  selector: 'rozie-portal-overlay',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    @if (open()) {
    <div class="rozie-portal-overlay-backdrop" #roziePortal_0>
      <div class="rozie-portal-overlay-box">
        @if ((defaultTpl ?? templates()?.['defaultSlot'])) {
    <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
    } @else {
    Portalled content
    }
      </div>
    </div>
    }
  `,
  styles: [`
    :host(rozie-portal-overlay) { display: contents; }
    .rozie-portal-overlay-backdrop {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.4);
      z-index: var(--rozie-portal-overlay-z, 3000);
    }
    .rozie-portal-overlay-box {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      min-width: 16rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    ::ng-deep :root {
    --rozie-portal-overlay-z: 3000;
    }
  `],
})
export class PortalOverlay {
  open = input<boolean>(false);
  to = input<boolean | string>(false);
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  resolveTo = (to: any) => {
    if (!to) return null;
    if (typeof document === 'undefined') return null;
    if (to === true || to === 'body') return document.body;
    return document.querySelector(to);
  };

  static ngTemplateContextGuard(
    _dir: PortalOverlay,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

  private roziePortal_0 = viewChild<ElementRef>('roziePortal_0');

  private __roziePortalAnchors = new WeakMap<Element, { parent: Node | null; next: Node | null }>();

  private __roziePortalMoved = new Set<Element>();

  private __roziePortalPlace(el: Element, target: Element | null | undefined): void {
    let anchor = this.__roziePortalAnchors.get(el);
    if (!anchor) {
      anchor = { parent: el.parentNode, next: el.nextSibling };
      this.__roziePortalAnchors.set(el, anchor);
    }
    if (target) {
      target.appendChild(el);
      this.__roziePortalMoved.add(el);
      return;
    }
    this.__roziePortalMoved.delete(el);
    if (anchor.parent) {
      if (anchor.next && anchor.next.parentNode === anchor.parent) {
        anchor.parent.insertBefore(el, anchor.next);
      } else {
        anchor.parent.appendChild(el);
      }
    }
  }

  private __roziePortal_0_destroyRegistered = false;

  private __roziePortal_0_effect = effect(() => {
    const el = this.roziePortal_0()?.nativeElement;
    if (!el) return;
    this.__roziePortalPlace(el, this.resolveTo(this.to()));
    if (!this.__roziePortal_0_destroyRegistered) {
      this.__roziePortal_0_destroyRegistered = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const moved of this.__roziePortalMoved) {
          moved.parentNode?.removeChild(moved);
        }
      });
    }
  });
}

export default PortalOverlay;
