import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../core/utils';
import { I18nService } from '../../core/i18n/i18n.service';
import { GamesService } from '../../data/games.service';
import { Game, GameStatus } from '../../data/models';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { GameDialogComponent, GameDialogResult } from './game-dialog.component';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 450;

@Component({
  selector: 'app-catalog',
  imports: [IconComponent, PageHeaderComponent, GameDialogComponent],
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss',
})
export class CatalogPage {
  readonly i18n = inject(I18nService);
  readonly games = inject(GamesService);
  private readonly router = inject(Router);

  readonly query = signal('');
  readonly genre = signal('');
  readonly platform = signal('');
  readonly items = signal<Game[]>([]);
  readonly page = signal(1);
  readonly hasMore = signal(true);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly adding = signal<Set<string>>(new Set());
  readonly libraryIds = signal<Set<string>>(new Set());
  readonly pendingGame = signal<Game | null>(null);
  readonly conflict = signal<Game | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;

  constructor() {
    this.loadPage(1);
    this.loadLibrary();
  }

  historyBack(): void {
    void this.router.navigate(['/library']);
  }

  loadPage(page: number, append = false): void {
    const sequence = ++this.requestSeq;
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    this.games
      .getGames({
        search: this.query(),
        genre: this.genre(),
        platform: this.platform(),
        page,
        pageSize: PAGE_SIZE,
      })
      .subscribe({
        next: (games) => {
          if (sequence !== this.requestSeq) {
            return;
          }
          this.items.update((current) => (append ? [...current, ...games] : games));
          this.page.set(page);
          this.hasMore.set(games.length >= PAGE_SIZE);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (error: unknown) => {
          if (sequence !== this.requestSeq) {
            return;
          }
          this.loading.set(false);
          this.loadingMore.set(false);
          this.error.set(this.messageOf(error));
        },
      });
  }

  loadLibrary(): void {
    this.games.getMyGames().subscribe({
      next: (games) => this.libraryIds.set(new Set(games.map((game) => game.gameId))),
      error: () => undefined,
    });
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.scheduleLoad();
  }

  onGenreChange(value: string): void {
    this.genre.set(value);
    this.scheduleLoad();
  }

  onPlatformChange(value: string): void {
    this.platform.set(value);
    this.scheduleLoad();
  }

  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) {
      return;
    }
    this.loadPage(this.page() + 1, true);
  }

  isInLibrary(gameId: string): boolean {
    return this.libraryIds().has(gameId);
  }

  coverUrl(relative: string | null | undefined): string | null {
    return this.games.coverUrl(relative);
  }

  openDialog(game: Game): void {
    this.conflict.set(null);
    this.pendingGame.set(game);
  }

  closeDialog(): void {
    this.conflict.set(null);
    this.pendingGame.set(null);
  }

  isConflict(game: Game): boolean {
    return this.conflict()?.id === game.id;
  }

  confirm(game: Game, result: GameDialogResult): void {
    if (this.conflict()?.id === game.id) {
      this.confirmUpdate(game, result.status, result.favorite);
    } else {
      this.add(game, result.status, result.favorite);
    }
  }

  private scheduleLoad(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.loadPage(1), DEBOUNCE_MS);
  }

  private add(game: Game, status: GameStatus, favorite: boolean): void {
    if (this.adding().has(game.id)) {
      return;
    }
    this.adding.set(this.withSet(this.adding(), game.id, true));
    this.error.set(null);
    this.games.addToLibrary(game.id, status, favorite).subscribe({
      next: () => {
        this.adding.set(this.withSet(this.adding(), game.id, false));
        this.libraryIds.update((ids) => new Set([...ids, game.id]));
        this.closeDialog();
      },
      error: (error: unknown) => {
        this.adding.set(this.withSet(this.adding(), game.id, false));
        if (error instanceof ApiError && error.status === 409) {
          this.conflict.set(game);
          return;
        }
        this.error.set(this.messageOf(error));
      },
    });
  }

  private confirmUpdate(game: Game, status: GameStatus, favorite: boolean): void {
    if (this.adding().has(game.id)) {
      return;
    }
    this.adding.set(this.withSet(this.adding(), game.id, true));
    this.games.removeFromLibrary(game.id).subscribe({
      next: () => this.addAfterUpdate(game, status, favorite),
      error: () => this.addAfterUpdate(game, status, favorite),
    });
  }

  private addAfterUpdate(game: Game, status: GameStatus, favorite: boolean): void {
    this.games.addToLibrary(game.id, status, favorite).subscribe({
      next: () => {
        this.adding.set(this.withSet(this.adding(), game.id, false));
        this.libraryIds.update((ids) => new Set([...ids, game.id]));
        this.closeDialog();
      },
      error: (error: unknown) => {
        this.adding.set(this.withSet(this.adding(), game.id, false));
        this.error.set(this.messageOf(error));
      },
    });
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
