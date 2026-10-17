import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Friend, PendingRequest, SearchedUser } from './models';

@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly api = inject(ApiService);

  getFriends(): Observable<Friend[]> {
    return this.api.get<Friend[]>('users/me/friends').pipe(
      map((friends) =>
        friends.map((friend) => ({
          ...friend,
          firstName: friend.firstName ?? '',
          lastName: friend.lastName ?? '',
          isOnline: !!friend.isOnline,
        })),
      ),
    );
  }

  searchUsers(query: string): Observable<SearchedUser[]> {
    const params = new URLSearchParams({ query, page: '1', pageSize: '20' });
    return this.api.get<SearchedUser[]>(`users/search?${params.toString()}`).pipe(
      map((users) =>
        users.map((user) => ({
          ...user,
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.email ?? '',
        })),
      ),
    );
  }

  getPendingRequests(): Observable<PendingRequest[]> {
    return this.api.get<PendingRequest[]>('social/friend-requests').pipe(
      map((requests) =>
        requests.map((request) => ({
          ...request,
          otherName: request.otherName || 'Jogador',
          incoming: !!request.incoming,
        })),
      ),
    );
  }

  sendRequest(addresseeId: string): Observable<string> {
    return this.api.post<string>('social/friend-requests', { addresseeId });
  }

  respondRequest(requestId: string, accept: boolean): Observable<void> {
    return this.api.put<void>(`social/friend-requests/${requestId}`, {
      action: accept ? 'Accept' : 'Decline',
    });
  }

  removeFriend(friendId: string): Observable<void> {
    return this.api.delete<void>(`social/friends/${friendId}`);
  }
}
