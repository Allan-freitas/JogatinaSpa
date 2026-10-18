import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { I18nService } from '../core/i18n/i18n.service';
import { ApiError } from '../core/utils';
import { Friend, FriendRelation, PendingRequest, SearchedUser, fullName } from '../data/models';
import { SocialService } from '../data/social.service';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';

const SEARCH_DEBOUNCE_MS = 450;

@Component({
  selector: 'app-people-search-modal',
  imports: [IconComponent, ModalComponent],
  templateUrl: './people-search-modal.component.html',
  styleUrl: './people-search-modal.component.scss',
})
export class PeopleSearchModalComponent implements AfterViewInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly social = inject(SocialService);

  readonly closed = output<void>();

  readonly query = signal('');
  readonly results = signal<SearchedUser[]>([]);
  readonly searching = signal(false);
  readonly hasSearched = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyIds = signal<Set<string>>(new Set());
  readonly friends = signal<Friend[]>([]);
  readonly requests = signal<PendingRequest[]>([]);
  readonly sentIds = signal<Set<string>>(new Set());

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadRelations();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  close(): void {
    this.closed.emit();
  }

  onSearch(value: string): void {
    this.query.set(value);
    this.error.set(null);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    const query = value.trim();
    if (query.length < 2) {
      this.results.set([]);
      this.searching.set(false);
      this.hasSearched.set(false);
      return;
    }

    this.searching.set(true);
    this.searchTimer = setTimeout(() => {
      this.social.searchUsers(query).subscribe({
        next: (users) => {
          this.results.set(users);
          this.searching.set(false);
          this.hasSearched.set(true);
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
    if (
      this.sentIds().has(userId) ||
      this.requests().some((request) => !request.incoming && request.otherUserId === userId)
    ) {
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
        this.markSent(user.id);
      },
      error: (error: unknown) => {
        this.setBusy(user.id, false);
        if (error instanceof ApiError && error.status === 409) {
          this.markSent(user.id);
          return;
        }
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

  private loadRelations(): void {
    forkJoin({
      friends: this.social.getFriends(),
      requests: this.social.getPendingRequests(),
    }).subscribe({
      next: ({ friends, requests }) => {
        this.friends.set(friends);
        this.requests.set(requests);
      },
      error: () => undefined,
    });
  }

  private markSent(userId: string): void {
    this.sentIds.update((ids) => new Set([...ids, userId]));
    this.setBusy(userId, false);
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
