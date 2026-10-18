import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div class="modal-backdrop" (click)="closed.emit()">
      <div
        class="modal-card"
        [class.wide]="wide()"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()"
      >
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: max(16px, env(safe-area-inset-top, 0px)) 16px
          max(16px, env(safe-area-inset-bottom, 0px));
        background: rgba(2, 5, 18, 0.78);
        backdrop-filter: blur(6px);
        animation: fade 160ms ease-out;
      }
      .modal-card {
        width: 100%;
        max-width: 460px;
        max-height: calc(
          100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        );
        overflow-y: auto;
        overscroll-behavior: contain;
        border-radius: 20px;
        border: 1px solid rgba(255, 30, 156, 0.24);
        background: var(--navy-mid);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        padding: 20px;
        animation: rise 180ms ease-out;
      }
      .modal-card.wide {
        max-width: 620px;
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      @keyframes rise {
        from {
          transform: translateY(12px);
          opacity: 0;
        }
      }
    `,
  ],
})
export class ModalComponent {
  readonly wide = input(false);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
