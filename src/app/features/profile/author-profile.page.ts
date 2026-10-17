import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../core/utils';
import { I18nService, flagEmoji } from '../../core/i18n/i18n.service';
import { GamesService } from '../../data/games.service';
import { GAME_STATUSES, GameStatus, MyGame, PublicProfile, fullName } from '../../data/models';
import { UsersService } from '../../data/users.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-author-profile',
  imports: [AvatarComponent, IconComponent, PageHeaderComponent],
  templateUrl: './author-profile.page.html',
  styleUrl: './author-profile.page.scss',
})
export class AuthorProfilePage {
  readonly userId = input('');

  readonly i18n = inject(I18nService);
  private readonly users = inject(UsersService);
  private readonly gamesService = inject(GamesService);
  private readonly router = inject(Router);

  readonly profile = signal<PublicProfile | null>(null);
  readonly games = signal<MyGame[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly name = computed(() => {
    const profile = this.profile();
    return profile ? fullName(profile.firstName, profile.lastName) : '';
  });

  constructor() {
    effect(() => {
      const id = this.userId();
      if (id) {
        this.load(id);
      }
    });
  }

  back(): void {
    void this.router.navigate(['/feed']);
  }

  photoUrl(): string | null {
    return this.users.photoUrl(this.profile()?.photoUrl);
  }

  coverUrl(relative: string | null | undefined): string | null {
    return this.gamesService.coverUrl(relative);
  }

  countryLabel(code: string | null): string | null {
    if (!code) {
      return null;
    }
    return `${flagEmoji(code)} ${this.i18n.countryName(code) ?? code}`;
  }

  statusLabel(status: GameStatus): string {
    return this.i18n.t(
      GAME_STATUSES.find((item) => item.value === status)?.labelKey ?? 'status_wishlist',
    );
  }

  private load(userId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.users.getPublicProfile(userId).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.gamesService.getUserGames(userId).subscribe({
          next: (games) => {
            this.games.set(games);
            this.loading.set(false);
          },
          error: (error: unknown) => {
            this.loading.set(false);
            this.error.set(this.messageOf(error));
          },
        });
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  private messageOf(error: unknown): string {
    if (!(error instanceof ApiError) || error.message === 'network') {
      return this.i18n.t('network_error');
    }
    return error.message || this.i18n.t('error_generic');
  }
}
