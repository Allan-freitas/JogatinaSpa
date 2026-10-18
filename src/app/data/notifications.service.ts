import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ChatSocketService } from '../core/realtime/chat-socket.service';
import { AppNotification } from './models';

const POLL_INTERVAL_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(ApiService);
  private readonly socket = inject(ChatSocketService);

  readonly notifications = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly onlyUnread = signal(false);
  readonly markingAll = signal(false);
  readonly error = signal<string | null>(null);
  readonly unreadCount = computed(
    () => this.notifications().filter((notification) => !notification.isRead).length,
  );
  readonly visible = computed(() =>
    this.onlyUnread()
      ? this.notifications().filter((notification) => !notification.isRead)
      : this.notifications(),
  );

  private eventsSubscription: Subscription | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.eventsSubscription) {
      return;
    }
    this.eventsSubscription = this.socket.events$.subscribe((event) => {
      if (event.type === 'notification') {
        this.prepend(event.notification);
        this.showBrowserNotification(event.notification);
      } else if (event.type === 'message') {
        void this.refresh();
      }
    });
    this.pollTimer ??= setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
    void this.refresh();
  }

  stop(): void {
    this.eventsSubscription?.unsubscribe();
    this.eventsSubscription = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  refresh(): Promise<void> {
    if (this.loading()) {
      return Promise.resolve();
    }
    this.loading.set(true);
    return new Promise((resolve) => {
      this.api.get<AppNotification[]>('notifications').subscribe({
        next: (notifications) => {
          this.notifications.set(this.normalize(notifications));
          this.loading.set(false);
          this.error.set(null);
          resolve();
        },
        error: (error: Error) => {
          this.loading.set(false);
          this.error.set(error.message);
          resolve();
        },
      });
    });
  }

  setOnlyUnread(value: boolean): void {
    this.onlyUnread.set(value);
  }

  markAsRead(notification: AppNotification): void {
    if (notification.isRead) {
      return;
    }
    this.api.patch<string>(`notifications/${notification.id}/read`).subscribe({
      next: () => {
        this.notifications.update((items) =>
          items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
        );
      },
    });
  }

  markAllAsRead(): void {
    if (this.markingAll()) {
      return;
    }
    this.markingAll.set(true);
    this.api.post<number>('notifications/read-all').subscribe({
      next: () => {
        this.notifications.update((items) => items.map((item) => ({ ...item, isRead: true })));
        this.markingAll.set(false);
      },
      error: () => this.markingAll.set(false),
    });
  }

  requestBrowserPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  private prepend(notification: AppNotification): void {
    if (this.notifications().some((item) => item.id === notification.id)) {
      return;
    }
    this.notifications.set(this.normalize([notification, ...this.notifications()]));
  }

  private normalize(items: AppNotification[]): AppNotification[] {
    return [...items]
      .filter(
        (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
      )
      .sort((a, b) => (a.createdOnUtc < b.createdOnUtc ? 1 : -1));
  }

  private showBrowserNotification(notification: AppNotification): void {
    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      document.visibilityState !== 'visible'
    ) {
      new Notification(notification.title || 'Jogatina', {
        body: notification.body,
        icon: 'assets/jogatina-icon.png',
      });
    }
  }
}
