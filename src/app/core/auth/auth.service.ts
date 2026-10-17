import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { AccessTokens, UserProfile } from '../../data/models';
import { UsersService } from '../../data/users.service';
import { ApiService } from '../api.service';
import { collectDeviceInfo } from '../utils';
import { TokenStore } from './token.store';

export type RegisterOutcome = 'loggedIn' | 'created';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStore);
  private readonly users = inject(UsersService);

  readonly loggedIn = signal(this.tokens.isLoggedIn);
  readonly profile = signal<UserProfile | null>(null);
  readonly myUserId = computed(() => this.tokens.userId);
  readonly displayName = computed(() => {
    const profile = this.profile();
    return profile?.firstName?.trim() || profile?.email?.split('@')[0] || 'Jogador';
  });

  constructor() {
    this.api.sessionExpired.subscribe(() => this.clearSession());
    if (this.loggedIn()) {
      this.loadProfile();
    }
  }

  login(email: string, password: string): Observable<void> {
    return this.api
      .post<AccessTokens>(
        'auth/login',
        {
          email: email.trim(),
          password,
          device: collectDeviceInfo(),
        },
        { auth: false },
      )
      .pipe(
        tap((tokens) => {
          this.tokens.save(tokens);
          this.loggedIn.set(true);
          this.loadProfile();
        }),
        map(() => undefined),
      );
  }

  register(
    email: string,
    firstName: string,
    lastName: string,
    password: string,
  ): Observable<RegisterOutcome> {
    return this.api
      .post<string>(
        'auth/register',
        {
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
        },
        { auth: false },
      )
      .pipe(
        switchMap(() =>
          this.login(email, password).pipe(
            map(() => 'loggedIn' as RegisterOutcome),
            catchError(() => of('created' as RegisterOutcome)),
          ),
        ),
      );
  }

  loadProfile(): void {
    if (!this.loggedIn()) {
      return;
    }
    this.users.getMe().subscribe({
      next: (profile) => this.profile.set(profile),
      error: () => undefined,
    });
  }

  logout(): void {
    this.tokens.clear();
    this.clearSession();
  }

  private clearSession(): void {
    this.loggedIn.set(false);
    this.profile.set(null);
  }
}
