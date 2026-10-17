import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AppNotification, ChatMessage } from '../../data/models';
import { ApiService } from '../api.service';
import { TokenStore } from '../auth/token.store';

export type ChatEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'message'; message: ChatMessage }
  | { type: 'notification'; notification: AppNotification }
  | { type: 'read_ok'; conversationId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'authExpired' };

@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStore);

  readonly events$ = new Subject<ChatEvent>();
  readonly connected = signal(false);

  private socket: WebSocket | null = null;
  private manualClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private refreshing = false;

  connect(): void {
    this.manualClose = false;
    this.open();
  }

  disconnect(): void {
    this.manualClose = true;
    this.clearTimers();
    this.reconnectAttempts = 0;
    if (this.socket) {
      try {
        this.socket.close(1000, 'bye');
      } catch {
        // already gone
      }
    }
    this.socket = null;
    this.connected.set(false);
  }

  sendMessage(
    content: string,
    conversationId?: string | null,
    recipientId?: string | null,
  ): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    const frame: Record<string, string> = { type: 'send', content };
    if (conversationId) {
      frame['conversationId'] = conversationId;
    }
    if (recipientId) {
      frame['recipientId'] = recipientId;
    }
    this.socket.send(JSON.stringify(frame));
    return true;
  }

  markRead(conversationId: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(JSON.stringify({ type: 'read', conversationId }));
    return true;
  }

  private open(): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    const token = this.tokens.accessToken;
    if (!token) {
      return;
    }
    if (this.tokens.isAccessTokenExpired()) {
      if (this.refreshing) {
        return;
      }
      this.refreshing = true;
      this.api.refreshAccessToken().subscribe({
        next: () => {
          this.refreshing = false;
          this.open();
        },
        error: () => {
          this.refreshing = false;
          this.events$.next({ type: 'authExpired' });
          this.api.expireSession();
        },
      });
      return;
    }

    try {
      this.socket = new WebSocket(this.api.websocketUrl(token));
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.connected.set(true);
      this.startPing();
      this.events$.next({ type: 'connected' });
    };

    this.socket.onmessage = (event: MessageEvent<string>) => {
      this.handleFrame(event.data);
    };

    this.socket.onerror = () => {
      // onclose schedules the reconnect.
    };

    this.socket.onclose = (event: CloseEvent) => {
      this.socket = null;
      this.connected.set(false);
      this.stopPing();
      if (!this.manualClose) {
        this.events$.next({ type: 'disconnected', reason: event.reason || 'closed' });
        this.scheduleReconnect();
      }
    };
  }

  private handleFrame(raw: string): void {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (frame['type']) {
      case 'message': {
        const message = this.parseMessage(frame);
        if (message) {
          this.events$.next({ type: 'message', message });
        }
        break;
      }
      case 'notification': {
        const notification = this.parseNotification(frame);
        if (notification) {
          this.events$.next({ type: 'notification', notification });
        }
        break;
      }
      case 'read_ok':
        this.events$.next({
          type: 'read_ok',
          conversationId: String(frame['conversationId'] ?? ''),
        });
        break;
      case 'error':
        this.events$.next({
          type: 'error',
          code: String(frame['code'] ?? ''),
          message: String(frame['message'] ?? ''),
        });
        break;
      default:
        break;
    }
  }

  private parseMessage(frame: Record<string, unknown>): ChatMessage | null {
    const id = frame['id'];
    const conversationId = frame['conversationId'];
    const senderId = frame['senderId'];
    const content = frame['content'];
    if (!id || !conversationId || !senderId || content == null) {
      return null;
    }
    return {
      id: String(id),
      conversationId: String(conversationId),
      senderId: String(senderId),
      content: String(content),
      sentOnUtc: String(frame['sentOnUtc'] ?? new Date().toISOString()),
    };
  }

  private parseNotification(frame: Record<string, unknown>): AppNotification | null {
    const id = frame['id'];
    if (!id) {
      return null;
    }
    return {
      id: String(id),
      type: String(frame['notificationType'] ?? ''),
      title: String(frame['title'] ?? ''),
      body: String(frame['body'] ?? ''),
      isRead: !!frame['isRead'],
      createdOnUtc: String(frame['createdOnUtc'] ?? new Date().toISOString()),
      referenceType: frame['referenceType'] ? String(frame['referenceType']) : null,
      referenceId: frame['referenceId'] ? String(frame['referenceId']) : null,
    };
  }

  private scheduleReconnect(): void {
    if (this.manualClose || this.reconnectTimer) {
      return;
    }
    const delay = Math.min(15_000, 2_000 * Math.max(1, this.reconnectAttempts + 1));
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25_000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
