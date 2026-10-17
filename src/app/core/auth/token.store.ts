import { Injectable } from '@angular/core';
import { AccessTokens } from '../../data/models';

const ACCESS_KEY = 'jogatina_access_token';
const REFRESH_KEY = 'jogatina_refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  get isLoggedIn(): boolean {
    return !!this.accessToken?.trim();
  }

  get userId(): string | null {
    const payload = this.payload();
    if (!payload) {
      return null;
    }
    const value =
      (payload['sub'] as string | undefined) ??
      (payload['nameid'] as string | undefined) ??
      (payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as
        string | undefined);
    return value || null;
  }

  isAccessTokenExpired(leewaySeconds = 30): boolean {
    const payload = this.payload();
    const expiresAt = Number(payload?.['exp'] ?? 0);
    if (!expiresAt) {
      return false;
    }
    return expiresAt * 1000 <= Date.now() + leewaySeconds * 1000;
  }

  private payload(): Record<string, unknown> | null {
    const token = this.accessToken;
    const payload = token?.split('.')[1];
    if (!payload) {
      return null;
    }
    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
      );
      const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  save(tokens: AccessTokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}
