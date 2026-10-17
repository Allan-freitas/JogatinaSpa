import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatSocketService } from '../core/realtime/chat-socket.service';
import { ChatService } from './chat.service';
import { Conversation } from './models';

@Injectable({ providedIn: 'root' })
export class ChatStoreService {
  private readonly chat = inject(ChatService);
  private readonly socket = inject(ChatSocketService);

  readonly conversations = signal<Conversation[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly unreadTotal = computed(() =>
    this.conversations().reduce((total, item) => total + item.unreadCount, 0),
  );

  private eventsSubscription: Subscription | null = null;

  start(): void {
    if (this.eventsSubscription) {
      void this.refresh();
      return;
    }
    this.eventsSubscription = this.socket.events$.subscribe((event) => {
      if (event.type === 'message' || event.type === 'connected') {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  stop(): void {
    this.eventsSubscription?.unsubscribe();
    this.eventsSubscription = null;
    this.conversations.set([]);
  }

  refresh(): Promise<void> {
    if (this.loading()) {
      return Promise.resolve();
    }
    this.loading.set(true);
    return new Promise((resolve) => {
      this.chat.getConversations().subscribe({
        next: (conversations) => {
          this.conversations.set(conversations);
          this.loading.set(false);
          this.error.set(null);
          resolve();
        },
        error: () => {
          this.loading.set(false);
          resolve();
        },
      });
    });
  }
}
