import { Component, ViewEncapsulation, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-rmodel-lazy',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="rmodel-lazy">
      <input type="text" [ngModel]="draft()" (change)="draft.set($event.target.value)" [ngModelOptions]="{standalone: true}" placeholder="Commit on blur" />
      <p class="echo">Committed: {{ draft() }}</p>
    </div>

  `,
  styles: [`
    .rmodel-lazy { display: inline-flex; flex-direction: column; gap: 0.25rem; }
    .echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
  `],
})
export class RModelLazy {
  draft = signal('');
}

export default RModelLazy;
