import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiError } from '../../core/utils';
import { I18nService } from '../../core/i18n/i18n.service';
import { Friend, FriendRelation, PendingRequest, SearchedUser, fullName } from '../../data/models';
import { SocialService } from '../../data/social.service';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

type FriendsTab = 'friends' | 'requests' | 'search';

const SEARCH_DEBOUNCE_MS = 500;

@Component({
  selector: 'app-friends',
  imports: [IconComponent, PageHeaderComponent],
  templateUrl: './friends.page.html',
  styleUrl: './friends.page.scss',
})
export class FriendsPage {
  readonly i18n = inject(I18nService);
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);

  readonly tab = signal<FriendsTab>('friends');
  readonly friends = signal<Friend[]>([]);
  readonly requests = signal<PendingRequest[]>([]);
  readonly searchQuery = signal('');
  readonly searchResults = signal<SearchedUser[]>([]);
  readonly searching = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyIds = signal<Set<string>>(new Set());

  readonly incomingCount = computed(
    () => this.requests().filter((request) => request.incoming).length,
  );
  readonly incomingRequests = computed(() => this.requests().filter((request) => request.incoming));
  readonly outgoingRequests = computed(() =>
    this.requests().filter((request) => !request.incoming),
  );

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.refresh(true);
  }

  back(): void {
    void this.router.navigate(['/profile']);
  }

  setTab(tab: FriendsTab): void {
    this.tab.set(tab);
  }

  refresh(first = false): void {
    if (this.loading() && !first) {
      return;
    }
    this.loading.set(true);
    forkJoin({
      friends: this.social.getFriends(),
      requests: this.social.getPendingRequests(),
    }).subscribe({
      next: ({ friends, requests }) => {
        this.friends.set(friends);
        this.requests.set(requests);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  friendName(friend: Friend): string {
    return fullName(friend.firstName, friend.lastName);
  }

  chatWith(friend: Friend): void {
    void this.router.navigate(['/chat/new', friend.friendId], { state: { friend } });
  }

  removeFriend(friend: Friend): void {
    if (this.busyIds().has(friend.friendId)) {
      return;
    }
    this.setBusy(friend.friendId, true);
    this.social.removeFriend(friend.friendId).subscribe({
      next: () => {
        this.friends.update((friends) =>
          friends.filter((item) => item.friendId !== friend.friendId),
        );
        this.setBusy(friend.friendId, false);
      },
      error: (error: unknown) => {
        this.setBusy(friend.friendId, false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  respond(request: PendingRequest, accept: boolean): void {
    if (this.busyIds().has(request.requestId)) {
      return;
    }
    this.setBusy(request.requestId, true);
    this.social.respondRequest(request.requestId, accept).subscribe({
      next: () => {
        this.setBusy(request.requestId, false);
        this.refresh();
      },
      error: (error: unknown) => {
        this.setBusy(request.requestId, false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    const query = value.trim();
    if (query.length < 2) {
      this.searchResults.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchTimer = setTimeout(() => {
      this.social.searchUsers(query).subscribe({
        next: (users) => {
          this.searchResults.set(users);
          this.searching.set(false);
        },
        error: (error: unknown) => {
          this.searching.set(false);
          this.error.set(this.messageOf(error));
        },
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  relationOf(userId: string): FriendRelation {
    if (this.friends().some((friend) => friend.friendId === userId)) {
      return 'friend';
    }
    if (this.requests().some((request) => !request.incoming && request.otherUserId === userId)) {
      return 'sent';
    }
    return 'none';
  }

  sendRequest(user: SearchedUser): void {
    if (this.busyIds().has(user.id)) {
      return;
    }
    this.setBusy(user.id, true);
    this.social.sendRequest(user.id).subscribe({
      next: () => {
        this.setBusy(user.id, false);
        this.refresh();
      },
      error: (error: unknown) => {
        this.setBusy(user.id, false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  userName(user: SearchedUser): string {
    return fullName(user.firstName, user.lastName);
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  private setBusy(id: string, busy: boolean): void {
    const next = new Set(this.busyIds());
    if (busy) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.busyIds.set(next);
  }

  private messageOf(error: unknown): string {
    if (!(error instanceof ApiError) || error.message === 'network') {
      return this.i18n.t('network_error');
    }
    return error.message || this.i18n.t('error_generic');
  }
}
