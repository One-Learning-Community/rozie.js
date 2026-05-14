import { Component, ViewEncapsulation, input, signal } from '@angular/core';

@Component({
  selector: 'rozie-inline-expr-handler',
  standalone: true,
  template: `

    <div class="backdrop" (click)="closeOnBackdrop() && close()">
      
      <button (click)="close($event)">Close</button>
    </div>

  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; }
  `],
})
export class InlineExprHandler {
  closeOnBackdrop = input<boolean>(true);
  open = signal(false);

  close = () => {
    this.open.set(false);
  };
}

export default InlineExprHandler;
