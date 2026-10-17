import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  template: `
    <div
      class="avatar"
      [class.ring]="ring() && !!photoUrl()"
      [style.width.px]="size()"
      [style.height.px]="size()"
    >
      @if (photoUrl()) {
        <img [src]="photoUrl()" [alt]="name()" loading="lazy" />
      } @else {
        <span [style.font-size.px]="size() / 2.8">{{ initial() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .avatar {
        border-radius: 50%;
        background: rgba(255, 30, 156, 0.25);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex: 0 0 auto;
        color: var(--white);
        font-weight: 700;
      }
      .avatar.ring {
        box-shadow: 0 0 0 2px var(--white);
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `,
  ],
})
export class AvatarComponent {
  readonly photoUrl = input<string | null>(null);
  readonly name = input('Jogador');
  readonly size = input(40);
  readonly ring = input(true);

  readonly initial = computed(() => this.name().trim().charAt(0).toUpperCase() || '?');
}
