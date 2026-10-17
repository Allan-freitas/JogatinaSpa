import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { splitContent } from '../../core/utils';
import { ChatStoreService } from '../../data/chat-store.service';
import { conversationTitle, Friend, fullName } from '../../data/models';
import { SocialService } from '../../data/social.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-chat-list',
  imports: [AvatarComponent, IconComponent, ModalComponent, PageHeaderComponent],
  templateUrl: './chat-list.page.html',
  styleUrl: './chat-list.page.scss',
})
export class ChatListPage {
  readonly i18n = inject(I18nService);
  readonly store = inject(ChatStoreService);
  readonly auth = inject(AuthService);
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);

  readonly showNewChat = signal(false);
  readonly friends = signal<Friend[]>([]);
  readonly friendsLoading = signal(false);
  readonly friendsError = signal<string | null>(null);

  readonly myUserId = computed(() => this.auth.myUserId());

  constructor() {
    void this.store.refresh();
  }

  back(): void {
    void this.router.navigate(['/feed']);
  }

  openConversation(conversationId: string): void {
    void this.router.navigate(['/chat', conversationId]);
  }

  openNewChat(): void {
    this.showNewChat.set(true);
    this.friendsLoading.set(true);
    this.friendsError.set(null);
    this.social.getFriends().subscribe({
      next: (friends) => {
        this.friends.set(friends);
        this.friendsLoading.set(false);
      },
      error: () => {
        this.friendsLoading.set(false);
        this.friendsError.set(this.i18n.t('error_generic'));
      },
    });
  }

  closeNewChat(): void {
    this.showNewChat.set(false);
  }

  startConversation(friend: Friend): void {
    this.showNewChat.set(false);
    void this.router.navigate(['/chat/new', friend.friendId], { state: { friend } });
  }

  title(conversation: Parameters<typeof conversationTitle>[0]): string {
    return conversationTitle(conversation, this.myUserId());
  }

  friendName(friend: Friend): string {
    return fullName(friend.firstName, friend.lastName);
  }

  preview(content: string): string {
    const parts = splitContent(content);
    if (parts.text) {
      return parts.text;
    }
    return parts.images.length > 0 ? this.i18n.t('chat_image_label') : content;
  }

  initial(title: string): string {
    return title.trim().charAt(0).toUpperCase() || '?';
  }
}
