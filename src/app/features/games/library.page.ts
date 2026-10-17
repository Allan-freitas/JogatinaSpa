import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/utils';
import { I18nService } from '../../core/i18n/i18n.service';
import { GamesService } from '../../data/games.service';
import { Friend, GAME_STATUSES, GameStatus, MyGame } from '../../data/models';
import { SocialService } from '../../data/social.service';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { GameDialogComponent, GameDialogResult } from './game-dialog.component';

@Component({
  selector: 'app-library',
  imports: [RouterLink, IconComponent, PageHeaderComponent, GameDialogComponent],
  templateUrl: './library.page.html',
  styleUrl: './library.page.scss',
})
export class LibraryPage {
  readonly i18n = inject(I18nService);
  readonly games = inject(GamesService);
  private readonly social = inject(SocialService);

  readonly statuses = GAME_STATUSES;
  readonly items = signal<MyGame[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly filter = signal<GameStatus | null>(null);
  readonly removing = signal<Set<string>>(new Set());
  readonly updating = signal<Set<string>>(new Set());
  readonly friends = signal<Friend[]>([]);
  readonly editing = signal<MyGame | null>(null);

  readonly visible = computed(() => {
    const filter = this.filter();
    return this.items()
      .filter((game) => !filter || game.status === filter)
      .sort(
        (a, b) =>
          Number(b.isFavorite) - Number(a.isFavorite) || b.addedOnUtc.localeCompare(a.addedOnUtc),
      );
  });

  constructor() {
    this.load();
    this.loadFriends();
  }

  load(): void {
    this.loading.set(true);
    this.games.getMyGames().subscribe({
      next: (games) => {
        this.items.set(games);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  loadFriends(): void {
    this.social.getFriends().subscribe({
      next: (friends) => this.friends.set(friends),
      error: () => undefined,
    });
  }

  setFilter(status: GameStatus | null): void {
    this.filter.set(status);
  }

  coverUrl(relative: string | null | undefined): string | null {
    return this.games.coverUrl(relative);
  }

  statusLabel(status: GameStatus): string {
    return this.i18n.t(
      GAME_STATUSES.find((item) => item.value === status)?.labelKey ?? 'status_wishlist',
    );
  }

  statusClass(status: GameStatus): string {
    return status === 'Playing' ? 'playing' : status === 'Completed' ? 'completed' : 'wishlist';
  }

  openEditor(game: MyGame): void {
    this.editing.set(game);
  }

  toggleFavorite(game: MyGame): void {
    this.updateGame(game, game.status, !game.isFavorite, null, []);
  }

  remove(game: MyGame): void {
    if (this.removing().has(game.gameId)) {
      return;
    }
    this.removing.set(this.withSet(this.removing(), game.gameId, true));
    this.games.removeFromLibrary(game.gameId).subscribe({
      next: () => {
        this.items.update((items) => items.filter((item) => item.gameId !== game.gameId));
        this.removing.set(this.withSet(this.removing(), game.gameId, false));
      },
      error: (error: unknown) => {
        this.removing.set(this.withSet(this.removing(), game.gameId, false));
        this.error.set(this.messageOf(error));
      },
    });
  }

  saveFromDialog(game: MyGame, result: GameDialogResult): void {
    this.updateGame(game, result.status, result.favorite, result.cover, result.friendIds, () => {
      this.editing.set(null);
    });
  }

  closeEditor(): void {
    this.editing.set(null);
  }

  private updateGame(
    game: MyGame,
    status: GameStatus,
    isFavorite: boolean,
    cover: File | null,
    friendIds: string[],
    onDone?: () => void,
  ): void {
    if (this.updating().has(game.gameId)) {
      return;
    }
    this.updating.set(this.withSet(this.updating(), game.gameId, true));
    this.error.set(null);

    const swap = (): void => {
      this.games.removeFromLibrary(game.gameId).subscribe({
        next: () => add(),
        error: (error: unknown) => {
          const parsed = error as ApiError;
          if (parsed.status === 404) {
            add();
            return;
          }
          this.updating.set(this.withSet(this.updating(), game.gameId, false));
          this.error.set(this.messageOf(error));
        },
      });
    };

    const invite = (): void => {
      if (friendIds.length === 0) {
        this.updating.set(this.withSet(this.updating(), game.gameId, false));
        this.load();
        onDone?.();
        return;
      }
      const names = friendIds
        .map((id) => this.friends().find((friend) => friend.friendId === id))
        .filter((friend): friend is Friend => !!friend)
        .map((friend) => `${friend.firstName} ${friend.lastName}`.trim())
        .filter(Boolean);
      const message =
        names.length > 0
          ? this.i18n.t('post_play_invite', { game: game.title, friends: names.join(', ') })
          : null;
      this.games.inviteToPlay(game.gameId, friendIds, message).subscribe({
        next: () => {
          this.updating.set(this.withSet(this.updating(), game.gameId, false));
          this.load();
          onDone?.();
        },
        error: (error: unknown) => {
          this.updating.set(this.withSet(this.updating(), game.gameId, false));
          this.error.set(this.messageOf(error));
        },
      });
    };

    const add = (): void => {
      this.games.addToLibrary(game.gameId, status, isFavorite).subscribe({
        next: () => invite(),
        error: (error: unknown) => {
          this.updating.set(this.withSet(this.updating(), game.gameId, false));
          this.error.set(this.messageOf(error));
        },
      });
    };

    if (cover) {
      this.games.uploadCover(game.gameId, cover).subscribe({
        next: () => swap(),
        error: (error: unknown) => {
          this.updating.set(this.withSet(this.updating(), game.gameId, false));
          this.error.set(this.messageOf(error));
        },
      });
    } else {
      swap();
    }
  }

  private withSet(current: Set<string>, id: string, add: boolean): Set<string> {
    const next = new Set(current);
    if (add) {
      next.add(id);
    } else {
      next.delete(id);
    }
    return next;
  }

  private messageOf(error: unknown): string {
    if (!(error instanceof ApiError) || error.message === 'network') {
      return this.i18n.t('network_error');
    }
    return error.message || this.i18n.t('error_generic');
  }
}
