import { Component, ContentChild, TemplateRef, ViewEncapsulation, input, model } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Modal } from './Modal';

interface BrandCtx {}

interface DefaultCtx {}

interface ActionsCtx {}

@Component({
  selector: 'rozie-wrapper-modal',
  standalone: true,
  imports: [NgTemplateOutlet, Modal],
  template: `

    <rozie-modal [open]="open()" (openChange)="open.set($event)" [title]="title()"><ng-template #header>
        @if (brandTpl) {
    <ng-container *ngTemplateOutlet="brandTpl" />
    } @else {

          <h2>{{ title() }}</h2>
        
    }
      </ng-template><ng-template #footer>
        <ng-container *ngTemplateOutlet="actionsTpl" />
      </ng-template><ng-template #defaultSlot><ng-container *ngTemplateOutlet="defaultTpl" /></ng-template></rozie-modal>

  `,
})
export class WrapperModal {
  title = input<string>('Wrapped');
  open = model<boolean>(false);
  @ContentChild('brand', { read: TemplateRef }) brandTpl?: TemplateRef<BrandCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('actions', { read: TemplateRef }) actionsTpl?: TemplateRef<ActionsCtx>;

  static ngTemplateContextGuard(
    _dir: WrapperModal,
    _ctx: unknown,
  ): _ctx is BrandCtx | DefaultCtx | ActionsCtx {
    return true;
  }
}

export default WrapperModal;
