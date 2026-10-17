import { Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-page-header',
  imports: [IconComponent],
  template: `
    <header class="page-head">
      @if (back()) {
        <button
          type="button"
          class="icon-btn"
          (click)="backClicked.emit()"
          [attr.aria-label]="backLabel()"
        >
          <app-icon name="back" [size]="22" />
        </button>
      }
      <div class="page-head-text">
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="page-head-actions">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly back = input(false);
  readonly backLabel = input('Back');
  readonly backClicked = output<void>();
}
