import { Component, ContentChild, TemplateRef, ViewEncapsulation, forwardRef, input, model, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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
        @if ((brandTpl ?? templates()?.['brand'])) {
    <ng-container *ngTemplateOutlet="(brandTpl ?? templates()?.['brand'])" />
    } @else {

          <h2>{{ title() }}</h2>
        
    }
      </ng-template><ng-template #footer>
        <ng-container *ngTemplateOutlet="(actionsTpl ?? templates()?.['actions'])" />
      </ng-template><ng-template #defaultSlot><ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" /></ng-template></rozie-modal>

  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => WrapperModal),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class WrapperModal {
  title = input<string>('Wrapped');
  open = model<boolean>(false);
  @ContentChild('brand', { read: TemplateRef }) brandTpl?: TemplateRef<BrandCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('actions', { read: TemplateRef }) actionsTpl?: TemplateRef<ActionsCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  private __rozieCvaOnChange: (v: boolean) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  private __rozieCvaDisabled = signal(false);

  writeValue(v: boolean | null): void {
    this.open.set(v ?? false);
  }
  registerOnChange(fn: (v: boolean) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  static ngTemplateContextGuard(
    _dir: WrapperModal,
    _ctx: unknown,
  ): _ctx is BrandCtx | DefaultCtx | ActionsCtx {
    return true;
  }
}

export default WrapperModal;
