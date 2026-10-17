import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { AppNotification } from '../../data/models';
import { NotificationsService } from '../../data/notifications.service';
import { IconComponent, IconName } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-notifications',
  imports: [IconComponent, PageHeaderComponent],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage {
  readonly i18n = inject(I18nService);
  readonly store = inject(NotificationsService);
  private readonly router = inject(Router);

  constructor() {
    void this.store.refresh();
    this.store.requestBrowserPermission();
  }

  back(): void {
    void this.router.navigate(['/feed']);
  }

  open(notification: AppNotification): void {
    this.store.markAsRead(notification);
    if (notification.type === 'new_message' && notification.referenceId) {
      void this.router.navigate(['/chat', notification.referenceId]);
    }
  }

  iconOf(type: string): IconName {
    switch (type) {
      case 'friend_request':
        return 'person';
      case 'friend_accepted':
        return 'group';
      case 'new_message':
        return 'chat';
      case 'game_invite':
        return 'gamepad';
      default:
        return 'bell';
    }
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'friend_request':
        return this.i18n.t('notif_friend_request');
      case 'friend_accepted':
        return this.i18n.t('notif_friend_accepted');
      case 'new_message':
        return this.i18n.t('notif_new_message');
      case 'game_invite':
        return this.i18n.t('notif_game_invite');
      default:
        return this.i18n.t('notif_generic');
    }
  }
}
