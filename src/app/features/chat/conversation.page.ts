import { Component, ElementRef, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ChatEvent, ChatSocketService } from '../../core/realtime/chat-socket.service';
import { ApiError, splitContent, uuid } from '../../core/utils';
import { ChatService } from '../../data/chat.service';
import { ChatStoreService } from '../../data/chat-store.service';
import { ChatMessage, Friend, conversationTitle, fullName } from '../../data/models';
import { SocialService } from '../../data/social.service';
import { IconComponent } from '../../shared/icon.component';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-conversation',
  imports: [IconComponent],
  templateUrl: './conversation.page.html',
  styleUrl: './conversation.page.scss',
})
export class ConversationPage implements OnDestroy {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  readonly socket = inject(ChatSocketService);
  readonly store = inject(ChatStoreService);

  private readonly chat = inject(ChatService);
  private readonly social = inject(SocialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly messages = signal<ChatMessage[]>([]);
  readonly loadingHistory = signal(true);
  readonly error = signal<string | null>(null);
  readonly input = signal('');
  readonly pickedFile = signal<File | null>(null);
  readonly pickedPreview = signal<string | null>(null);
  readonly sending = signal(false);
  readonly uploading = signal(false);
  readonly hasDisconnected = signal(false);
  readonly conversationId = signal<string | null>(null);
  readonly recipientName = signal<string | null>(null);

  private friendId: string | null = null;
  private everConnected = false;
  private paramSubscription: Subscription | null = null;
  private eventsSubscription: Subscription | null = null;
  private scrollEl = viewChild<ElementRef<HTMLDivElement>>('scroll');

  constructor() {
    this.eventsSubscription = this.socket.events$.subscribe((event) => this.onSocketEvent(event));
    this.paramSubscription = this.route.paramMap.subscribe((params) => {
      this.onRouteChange(params.get('conversationId'), params.get('friendId'));
    });
    effect(() => {
      this.messages();
      setTimeout(() => {
        const element = this.scrollEl()?.nativeElement;
        if (element) {
          element.scrollTop = element.scrollHeight;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.paramSubscription?.unsubscribe();
    this.eventsSubscription?.unsubscribe();
    this.revokePreview(this.pickedPreview());
  }

  title(): string {
    const id = this.conversationId();
    if (id) {
      const conversation = this.store.conversations().find((item) => item.conversationId === id);
      if (conversation) {
        return conversationTitle(conversation, this.auth.myUserId());
      }
    }
    return this.recipientName() || this.i18n.t('conversation_fallback');
  }

  connectionText(): string {
    if (this.socket.connected()) {
      return this.i18n.t('chat_online');
    }
    return this.hasDisconnected()
      ? this.i18n.t('chat_reconnecting')
      : this.i18n.t('chat_connecting');
  }

  conversationInitial(): string {
    return this.title().trim().charAt(0).toUpperCase() || '?';
  }

  senderInitial(message: ChatMessage): string {
    const conversation =
      this.store.conversations().find((item) => item.conversationId === message.conversationId) ??
      this.store
        .conversations()
        .find((item) => item.participants.some((p) => p.userId === message.senderId));
    const participant = conversation?.participants.find((p) => p.userId === message.senderId);
    return (participant?.firstName?.trim().charAt(0) || this.conversationInitial()).toUpperCase();
  }

  back(): void {
    void this.router.navigate(['/chat']);
  }

  onInput(value: string): void {
    this.input.set(value);
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.error.set(this.i18n.t('image_too_big'));
      return;
    }
    this.revokePreview(this.pickedPreview());
    this.pickedFile.set(file);
    this.pickedPreview.set(URL.createObjectURL(file));
  }

  clearFile(): void {
    this.revokePreview(this.pickedPreview());
    this.pickedFile.set(null);
    this.pickedPreview.set(null);
  }

  send(): void {
    if (this.sending()) {
      return;
    }
    const text = this.input().trim();
    const file = this.pickedFile();
    if (!text && !file) {
      return;
    }
    if (!this.socket.connected()) {
      this.error.set(this.i18n.t('chat_offline'));
      return;
    }
    if (file) {
      this.sending.set(true);
      this.uploading.set(true);
      this.chat.uploadImage(file).subscribe({
        next: (url) => {
          this.uploading.set(false);
          this.sendContent(text ? `${text}\n${url}` : url, true);
        },
        error: (error: unknown) => {
          this.uploading.set(false);
          this.sending.set(false);
          this.error.set(this.messageOf(error));
        },
      });
      return;
    }
    this.sendContent(text, false);
  }

  isMine(message: ChatMessage): boolean {
    const userId = this.auth.myUserId();
    return !!userId && message.senderId.toLowerCase() === userId.toLowerCase();
  }

  isPending(message: ChatMessage): boolean {
    return message.id.startsWith('pending:');
  }

  partsOf(content: string): { text: string; images: string[] } {
    return splitContent(content);
  }

  imageUrl(token: string): string {
    return this.chat.imageUrl(token) ?? token;
  }

  private onRouteChange(conversationId: string | null, friendId: string | null): void {
    this.error.set(null);
    this.friendId = friendId;
    this.conversationId.set(conversationId);

    if (conversationId) {
      this.resolveRecipientFromConversation(conversationId);
      this.loadHistory(conversationId);
      this.socket.markRead(conversationId);
      return;
    }

    if (friendId) {
      const stateFriend = (history.state?.friend as Friend | undefined) ?? null;
      if (stateFriend && stateFriend.friendId === friendId) {
        this.recipientName.set(fullName(stateFriend.firstName, stateFriend.lastName));
      } else {
        this.social.getFriends().subscribe({
          next: (friends) => {
            const friend = friends.find((item) => item.friendId === friendId);
            if (friend) {
              this.recipientName.set(fullName(friend.firstName, friend.lastName));
            }
          },
          error: () => undefined,
        });
      }
      this.messages.set([]);
      this.loadingHistory.set(false);
      this.resolveExistingConversation(friendId);
      return;
    }

    this.loadingHistory.set(false);
  }

  private resolveExistingConversation(friendId: string): void {
    this.chat.getConversations().subscribe({
      next: (conversations) => {
        const existing = conversations.find((conversation) =>
          conversation.participants.some((participant) => participant.userId === friendId),
        );
        if (existing && !this.conversationId()) {
          void this.router.navigate(['/chat', existing.conversationId], { replaceUrl: true });
        }
      },
      error: () => undefined,
    });
  }

  private resolveRecipientFromConversation(conversationId: string): void {
    const current = this.store
      .conversations()
      .find((conversation) => conversation.conversationId === conversationId);
    if (current) {
      this.recipientName.set(conversationTitle(current, this.auth.myUserId()));
      return;
    }
    this.chat.getConversations().subscribe({
      next: (conversations) => {
        const found = conversations.find(
          (conversation) => conversation.conversationId === conversationId,
        );
        if (found) {
          this.recipientName.set(conversationTitle(found, this.auth.myUserId()));
        }
      },
      error: () => undefined,
    });
  }

  private sendContent(content: string, clearAttachment: boolean): void {
    const conversationId = this.conversationId();
    const friendId = this.friendId;
    const sent = conversationId
      ? this.socket.sendMessage(content, conversationId)
      : friendId
        ? this.socket.sendMessage(content, null, friendId)
        : false;

    if (!sent) {
      this.sending.set(false);
      this.error.set(this.i18n.t('chat_send_failed'));
      return;
    }

    const optimistic: ChatMessage = {
      id: `pending:${uuid()}`,
      conversationId: conversationId ?? '',
      senderId: this.auth.myUserId() ?? '',
      content,
      sentOnUtc: new Date().toISOString(),
    };
    this.messages.update((messages) => this.merge(messages, [optimistic]));
    this.input.set('');
    if (clearAttachment) {
      this.clearFile();
    }
    this.sending.set(false);
    this.error.set(null);

    if (conversationId) {
      setTimeout(() => this.loadHistory(conversationId), 450);
    } else if (friendId) {
      this.resolveNewConversation(friendId);
    }
  }

  private loadHistory(conversationId: string): void {
    this.loadingHistory.set(this.messages().length === 0);
    this.chat.getMessages(conversationId).subscribe({
      next: (serverMessages) => {
        const pending = this.messages().filter((message) => message.id.startsWith('pending:'));
        const unmatched = pending.filter(
          (message) =>
            !serverMessages.some(
              (server) =>
                server.senderId === message.senderId && server.content === message.content,
            ),
        );
        this.messages.set(this.merge(serverMessages, unmatched));
        this.loadingHistory.set(false);
        this.socket.markRead(conversationId);
      },
      error: (error: unknown) => {
        this.loadingHistory.set(false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  private resolveNewConversation(friendId: string): void {
    let attempts = 0;
    const tryFind = (): void => {
      this.chat.getConversations().subscribe({
        next: (conversations) => {
          const found = conversations.find((conversation) =>
            conversation.participants.some((participant) => participant.userId === friendId),
          );
          if (found) {
            this.conversationId.set(found.conversationId);
            this.socket.markRead(found.conversationId);
            void this.router.navigate(['/chat', found.conversationId], { replaceUrl: true });
            return;
          }
          attempts += 1;
          if (attempts < 10) {
            setTimeout(tryFind, 600);
          }
        },
        error: () => undefined,
      });
    };
    setTimeout(tryFind, 600);
  }

  private onSocketEvent(event: ChatEvent): void {
    switch (event.type) {
      case 'connected':
        if (this.everConnected) {
          const id = this.conversationId();
          if (id) {
            this.loadHistory(id);
          }
        }
        this.everConnected = true;
        break;
      case 'disconnected':
        this.hasDisconnected.set(true);
        break;
      case 'message': {
        const id = this.conversationId();
        if (id && event.message.conversationId === id) {
          this.messages.update((messages) => this.merge(messages, [event.message]));
          this.socket.markRead(id);
        }
        break;
      }
      case 'error':
        this.error.set(event.message || this.i18n.t('error_generic'));
        break;
      default:
        break;
    }
  }

  private merge(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    const map = new Map<string, ChatMessage>();
    for (const message of [...current, ...incoming]) {
      map.set(message.id, message);
    }
    return [...map.values()].sort((a, b) => a.sentOnUtc.localeCompare(b.sentOnUtc));
  }

  private revokePreview(url: string | null): void {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private messageOf(error: unknown): string {
    if (!(error instanceof ApiError) || error.message === 'network') {
      return this.i18n.t('network_error');
    }
    return error.message || this.i18n.t('error_generic');
  }
}
