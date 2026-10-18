import { Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-confirm-modal',
  imports: [ModalComponent, IconComponent],
  template: `
    <app-modal (closed)="dismiss()">
      <div class="confirm-body">
        <span class="confirm-icon" [class.destructive]="destructive()">
          <app-icon [name]="destructive() ? 'trash' : 'check'" [size]="26" />
        </span>
        <h2>{{ title() }}</h2>
        @if (message()) {
          <p>{{ message() }}</p>
        }
      </div>

      <div class="modal-actions">
        <button type="button" class="btn ghost" [disabled]="busy()" (click)="cancelled.emit()">
          {{ cancelLabel() }}
        </button>
        <button
          type="button"
          class="btn"
          [class.danger]="destructive()"
          [class.primary]="!destructive()"
          [disabled]="busy()"
          (click)="confirmed.emit()"
        >
          @if (busy()) {
            <span class="spinner white small"></span>
          } @else {
            {{ confirmLabel() }}
          }
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .confirm-body {
        text-align: center;
        padding: 6px 4px 2px;
      }

      .confirm-icon {
        width: 62px;
        height: 62px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        background: rgba(255, 30, 156, 0.16);
        color: var(--magenta-glow);
        box-shadow: 0 0 28px rgba(255, 30, 156, 0.18);
      }

      .confirm-icon.destructive {
        background: rgba(244, 63, 94, 0.16);
        color: #ff8398;
        box-shadow: 0 0 28px rgba(244, 63, 94, 0.16);
      }

      h2 {
        font-size: 19px;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      p {
        color: var(--subtitle);
        font-size: 14px;
        line-height: 1.55;
        margin-top: 8px;
        white-space: pre-line;
      }

      .modal-actions {
        justify-content: center;
        gap: 10px;
      }

      .modal-actions .btn {
        min-width: 118px;
      }
    `,
  ],
})
export class ConfirmModalComponent {
  readonly title = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input('OK');
  readonly cancelLabel = input('Cancel');
  readonly destructive = input(false);
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  dismiss(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
