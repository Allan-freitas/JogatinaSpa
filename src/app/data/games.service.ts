import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { fileExtension } from '../core/utils';
import { Game, GameStatus, MyGame } from './models';

export interface GameQuery {
  search?: string;
  genre?: string;
  platform?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly api = inject(ApiService);

  getGames(query: GameQuery = {}): Observable<Game[]> {
    const params = new URLSearchParams();
    params.set('page', String(query.page ?? 1));
    params.set('pageSize', String(query.pageSize ?? 20));
    if (query.search?.trim()) {
      params.set('search', query.search.trim());
    }
    if (query.genre?.trim()) {
      params.set('genre', query.genre.trim());
    }
    if (query.platform?.trim()) {
      params.set('platform', query.platform.trim());
    }
    return this.api.get<Game[]>(`games?${params.toString()}`).pipe(
      map((games) =>
        games.map((game) => ({
          ...game,
          genre: game.genre ?? '',
          platform: game.platform ?? '',
          popularity: game.popularity ?? 0,
          coverImageUrl: game.coverImageUrl || null,
        })),
      ),
    );
  }

  getMyGames(): Observable<MyGame[]> {
    return this.api
      .get<MyGame[]>('users/me/games')
      .pipe(map((games) => games.map((game) => this.normalizeMyGame(game))));
  }

  getUserGames(userId: string): Observable<MyGame[]> {
    return this.api
      .get<MyGame[]>(`users/${userId}/games`)
      .pipe(map((games) => games.map((game) => this.normalizeMyGame(game))));
  }

  addToLibrary(gameId: string, status: GameStatus, isFavorite: boolean): Observable<string> {
    return this.api.post<string>('users/me/games', { gameId, status, isFavorite });
  }

  removeFromLibrary(gameId: string): Observable<void> {
    return this.api.delete<void>(`users/me/games/${gameId}`);
  }

  inviteToPlay(gameId: string, friendIds: string[], message: string | null): Observable<number> {
    return this.api
      .post<{ notified: number }>(`games/${gameId}/invites`, {
        friendIds,
        ...(message ? { message } : {}),
      })
      .pipe(map((response) => response.notified ?? 0));
  }

  uploadCover(gameId: string, file: File): Observable<string> {
    const extension = fileExtension(file.type);
    const named = new File([file], file.name?.includes('.') ? file.name : `cover.${extension}`, {
      type: file.type || 'image/jpeg',
    });
    return this.api
      .upload<{ coverImageUrl: string }>(`games/${gameId}/cover`, named, 'PUT')
      .pipe(map((response) => response.coverImageUrl));
  }

  coverUrl(relative: string | null | undefined): string | null {
    return this.api.absoluteUrl(relative);
  }

  private normalizeMyGame(game: MyGame): MyGame {
    const status = game.status as string;
    return {
      ...game,
      status: status === 'Playing' ? 'Playing' : status === 'Completed' ? 'Completed' : 'Wishlist',
      isFavorite: !!game.isFavorite,
      coverImageUrl: game.coverImageUrl || null,
    };
  }
}
