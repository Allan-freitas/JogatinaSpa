import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, Inject, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  Subject,
  TimeoutError,
  catchError,
  finalize,
  map,
  retry,
  shareReplay,
  switchMap,
  tap,
  throwError,
  timeout,
  timer,
} from 'rxjs';
import { AccessTokens } from '../data/models';
import { API_BASE_URL } from './config';
import { TokenStore } from './auth/token.store';
import { ApiError, parseApiError } from './utils';

export interface RequestOptions {
  auth?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStore);
  private readonly router = inject(Router);

  readonly sessionExpired = new Subject<void>();

  private refreshInFlight$: Observable<string> | null = null;

  constructor(@Inject(API_BASE_URL) private readonly baseUrl: string) {}

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('POST', path, body ?? {}, options);
  }

  put<T>(path: string, body?: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('PUT', path, body ?? {}, options);
  }

  patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('PATCH', path, body ?? {}, options);
  }

  delete<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  upload<T>(
    path: string,
    file: File,
    method: 'POST' | 'PUT' = 'POST',
    options: RequestOptions = {},
  ): Observable<T> {
    const form = new FormData();
    form.append('file', file, file.name || 'upload');
    return this.request<T>(method, path, form, options);
  }

  absoluteUrl(relative: string | null | undefined): string | null {
    if (!relative || relative.trim() === '' || relative.toLowerCase() === 'null') {
      return null;
    }
    if (/^https?:\/\//i.test(relative)) {
      return relative;
    }
    return `${this.baseUrl.replace(/\/$/, '')}${relative.startsWith('/') ? '' : '/'}${relative}`;
  }

  websocketUrl(token: string): string {
    const base = this.baseUrl.trim().replace(/\/$/, '');
    const origin = base
      ? base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:')
      : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
    return `${origin}/ws/chat?access_token=${encodeURIComponent(token)}`;
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.tokens.refreshToken;
    if (!refreshToken) {
      return throwError(() => new ApiError('Sessão expirada', 401));
    }
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }
    this.refreshInFlight$ = this.http
      .post<AccessTokens>(this.url('auth/refresh-token'), { refreshToken })
      .pipe(
        tap((tokens) => this.tokens.save(tokens)),
        map((tokens) => tokens.accessToken),
        catchError((error) => {
          this.tokens.clear();
          return throwError(() => parseApiError(error));
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight$;
  }

  expireSession(): void {
    this.tokens.clear();
    this.sessionExpired.next();
    void this.router.navigate(['/welcome']);
  }

  private request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions,
    explicitToken?: string | null,
    alreadyRetried = false,
  ): Observable<T> {
    const useAuth = options.auth !== false;
    const token = useAuth ? (explicitToken ?? this.tokens.accessToken) : null;
    let headers = new HttpHeaders({ Accept: 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http
      .request<T>(method, this.url(path), {
        body,
        headers,
        responseType: 'json' as 'json',
      })
      .pipe(
        timeout({ each: 45_000 }),
        retry({
          count: 1,
          delay: (error) =>
            error instanceof TimeoutError ||
            (error instanceof HttpErrorResponse && error.status === 0)
              ? timer(900)
              : throwError(() => error),
        }),
        catchError((error: unknown) => {
          if (error instanceof TimeoutError) {
            return throwError(() => new ApiError('network', null));
          }
          const parsed = parseApiError(error);
          if (parsed.status === 401 && token && !alreadyRetried && useAuth) {
            return this.refreshAccessToken().pipe(
              switchMap((freshToken) =>
                this.request<T>(method, path, body, options, freshToken, true),
              ),
              catchError(() => {
                this.expireSession();
                return throwError(() => parsed);
              }),
            );
          }
          if (parsed.status === 401 && useAuth && token) {
            this.expireSession();
          }
          return throwError(() => parsed);
        }),
      );
  }

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/$/, '');
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
  }
}
