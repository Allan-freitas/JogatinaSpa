import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { fileExtension } from '../core/utils';
import { ChatMessage, Conversation } from './models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);

  getConversations(): Observable<Conversation[]> {
    return this.api.get<Conversation[]>('chat/conversations').pipe(
      map((conversations) =>
        conversations.map((conversation) => ({
          ...conversation,
          participants: (conversation.participants ?? []).map((participant) => ({
            ...participant,
            firstName: participant.firstName ?? '',
            lastName: participant.lastName ?? '',
          })),
          lastMessage: conversation.lastMessage ?? null,
          unreadCount: conversation.unreadCount ?? 0,
        })),
      ),
    );
  }

  getMessages(conversationId: string, page = 1, pageSize = 50): Observable<ChatMessage[]> {
    return this.api.get<ChatMessage[]>(
      `chat/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`,
    );
  }

  uploadImage(file: File): Observable<string> {
    const extension = fileExtension(file.type);
    const named = new File([file], file.name?.includes('.') ? file.name : `upload.${extension}`, {
      type: file.type || 'image/jpeg',
    });
    return this.api
      .upload<{ imageUrl: string }>('chat/images', named)
      .pipe(map((response) => response.imageUrl));
  }

  imageUrl(relative: string | null | undefined): string | null {
    return this.api.absoluteUrl(relative);
  }
}
