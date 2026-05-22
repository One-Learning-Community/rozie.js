import { Component, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'rozie-badge-grid-styled-scss',
  standalone: true,
  template: `

    <div class="badge-grid">
      @for (badge of badges(); track badge) {
    <span class="badge badge--neutral">
        {{ badge }}
      </span>
    }
    </div>

  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 4px;
      font-weight: 600;
    }
    .badge-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
    .badge {
      padding: 2px 8px;
    }
    .badge--neutral {
      color: #ffffff;
      background: #6b7280;
    }
    .badge--success {
      color: #ffffff;
      background: #16a34a;
    }
    .badge--warning {
      color: #ffffff;
      background: #d97706;
    }
    .badge--danger {
      color: #ffffff;
      background: #dc2626;
    }
    .badge-grid--gap-1 {
      gap: 4px;
    }
    .badge-grid--gap-2 {
      gap: 8px;
    }
    .badge-grid--gap-3 {
      gap: 12px;
    }
  `],
})
export class BadgeGridStyledScss {
  badges = input<any[]>((() => [])());
}

export default BadgeGridStyledScss;
