export interface AccessTokens {
  accessToken: string;
  refreshToken: string;
}

export interface DeviceInfo {
  platform: string;
  model?: string;
  manufacturer?: string;
  osVersion?: string;
  sdkVersion?: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
  deviceId?: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  content: string | null;
  imageUrl: string | null;
  createdOnUtc: string;
  totalReactions: number;
  reactionCounts: Record<string, number>;
  myReaction: string | null;
  commentCount: number;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl: string | null;
  content: string;
  createdOnUtc: string;
  replies: Comment[];
}

export interface ReactionResult {
  myReaction: string | null;
  totalReactions: number;
  counts: Record<string, number>;
}

export type ReactionKind = 'heart' | 'celebrate' | 'wow' | 'haha' | 'insightful';

export const REACTIONS: ReadonlyArray<{ kind: ReactionKind; emoji: string; labelKey: string }> = [
  { kind: 'heart', emoji: '❤️', labelKey: 'reaction_heart' },
  { kind: 'celebrate', emoji: '🎉', labelKey: 'reaction_celebrate' },
  { kind: 'wow', emoji: '😮', labelKey: 'reaction_wow' },
  { kind: 'haha', emoji: '😂', labelKey: 'reaction_haha' },
  { kind: 'insightful', emoji: '💡', labelKey: 'reaction_insightful' },
];

export function reactionEmoji(kind: string | null | undefined): string {
  return REACTIONS.find((r) => r.kind === kind)?.emoji ?? '❤️';
}

export function topReactionEmojis(counts: Record<string, number>, take = 3): string {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, take)
    .map(([kind]) => reactionEmoji(kind))
    .join('');
}

export type GameStatus = 'Wishlist' | 'Playing' | 'Completed';

export const GAME_STATUSES: ReadonlyArray<{ value: GameStatus; labelKey: string }> = [
  { value: 'Wishlist', labelKey: 'status_wishlist' },
  { value: 'Playing', labelKey: 'status_playing' },
  { value: 'Completed', labelKey: 'status_completed' },
];

export interface Game {
  id: string;
  title: string;
  genre: string;
  platform: string;
  popularity: number;
  coverImageUrl: string | null;
}

export interface MyGame {
  id: string;
  gameId: string;
  title: string;
  genre: string;
  platform: string;
  status: GameStatus;
  isFavorite: boolean;
  coverImageUrl: string | null;
  addedOnUtc: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  birthDate: string | null;
  hobbies: string | null;
  country: string | null;
}

export interface PublicProfile {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  hobbies: string | null;
  country: string | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdOnUtc: string;
  referenceType: string | null;
  referenceId: string | null;
}

export interface ChatParticipant {
  userId: string;
  firstName: string;
  lastName: string;
}

export interface ConversationLastMessage {
  id: string;
  senderId: string;
  content: string;
  sentOnUtc: string;
}

export interface Conversation {
  conversationId: string;
  participants: ChatParticipant[];
  lastMessage: ConversationLastMessage | null;
  unreadCount: number;
  updatedOnUtc: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sentOnUtc: string;
}

export interface Friend {
  friendId: string;
  firstName: string;
  lastName: string;
  isOnline: boolean;
}

export interface SearchedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PendingRequest {
  requestId: string;
  otherUserId: string;
  otherName: string;
  incoming: boolean;
  createdOnUtc: string;
}

export type FriendRelation = 'friend' | 'sent' | 'none';

export function fullName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter((part) => part.trim().length > 0).join(' ') || 'Jogador';
}

export function displayName(profile: { firstName: string; email?: string }): string {
  return profile.firstName?.trim() || profile.email?.split('@')[0] || 'Jogador';
}

export function birthDateDisplay(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parts = value.split('-');
  return parts.length === 3 ? parts.reverse().join('/') : value;
}

export function conversationTitle(conversation: Conversation, myUserId: string | null): string {
  const others = conversation.participants.filter((participant) => participant.userId !== myUserId);
  if (others.length === 0) {
    const first = conversation.participants[0];
    return first ? fullName(first.firstName, first.lastName) : 'Conversa';
  }
  if (others.length === 1) {
    return fullName(others[0].firstName, others[0].lastName);
  }
  return (
    others
      .map((participant) => participant.firstName)
      .filter(Boolean)
      .join(', ') || 'Grupo'
  );
}
