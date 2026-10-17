import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PublicProfile, UserProfile } from './models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  getMe(): Observable<UserProfile> {
    return this.api.get<UserProfile>('users/me').pipe(map((profile) => this.normalize(profile)));
  }

  updateProfile(
    birthDate: string | null,
    hobbies: string | null,
    country: string | null,
  ): Observable<UserProfile> {
    return this.api
      .put<UserProfile>('users/me', {
        birthDate: birthDate ?? null,
        hobbies: hobbies ?? null,
        country: country ?? null,
      })
      .pipe(map((profile) => this.normalize(profile)));
  }

  uploadPhoto(file: File): Observable<string> {
    return this.api
      .upload<{ photoUrl: string }>('users/me/photo', file)
      .pipe(map((response) => response.photoUrl));
  }

  getPublicProfile(userId: string): Observable<PublicProfile> {
    return this.api.get<PublicProfile>(`users/${userId}/profile`).pipe(
      map((profile) => ({
        id: profile.id,
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        photoUrl: profile.photoUrl || null,
        hobbies: profile.hobbies || null,
        country: profile.country || null,
      })),
    );
  }

  photoUrl(relative: string | null | undefined): string | null {
    return this.api.absoluteUrl(relative);
  }

  private normalize(profile: UserProfile): UserProfile {
    return {
      id: profile.id,
      email: profile.email ?? '',
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      photoUrl: profile.photoUrl || null,
      birthDate: profile.birthDate || null,
      hobbies: profile.hobbies || null,
      country: profile.country || null,
    };
  }
}
