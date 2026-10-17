import { Component, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { ChatSocketService } from '../core/realtime/chat-socket.service';
import { ChatStoreService } from '../data/chat-store.service';
import { NotificationsService } from '../data/notifications.service';
import { AvatarComponent } from '../shared/avatar.component';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, AvatarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly api = inject(ApiService);
  readonly chatStore = inject(ChatStoreService);
  readonly notifications = inject(NotificationsService);

  private readonly socket = inject(ChatSocketService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      const loggedIn = this.auth.loggedIn();
      untracked(() => {
        if (loggedIn) {
          this.socket.connect();
          this.chatStore.start();
          this.notifications.start();
        } else {
          this.socket.disconnect();
          this.chatStore.stop();
          this.notifications.stop();
        }
      });
    });
  }

  toggleLanguage(): void {
    this.i18n.toggle();
  }

  openChat(): void {
    void this.chatStore.refresh();
  }

  openNotifications(): void {
    void this.notifications.refresh();
  }

  logout(): void {
    this.auth.logout();
    this.socket.disconnect();
    this.chatStore.stop();
    this.notifications.stop();
    void this.router.navigate(['/welcome']);
  }
}
