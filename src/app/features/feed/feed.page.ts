import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError, splitContent } from '../../core/utils';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { FeedService } from '../../data/feed.service';
import { Comment, Post, REACTIONS, reactionEmoji, topReactionEmojis } from '../../data/models';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-feed',
  imports: [RouterLink, AvatarComponent, IconComponent, PageHeaderComponent],
  templateUrl: './feed.page.html',
  styleUrl: './feed.page.scss',
})
export class FeedPage implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly feed = inject(FeedService);

  readonly reactions = REACTIONS;

  readonly posts = signal<Post[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly composerText = signal('');
  readonly composerFile = signal<File | null>(null);
  readonly composerPreview = signal<string | null>(null);
  readonly publishing = signal(false);

  readonly expanded = signal<Set<string>>(new Set());
  readonly comments = signal<Record<string, Comment[]>>({});
  readonly commentsLoading = signal<Set<string>>(new Set());
  readonly commentInputs = signal<Record<string, string>>({});
  readonly commentFiles = signal<Record<string, File | null>>({});
  readonly commentPreviews = signal<Record<string, string | null>>({});
  readonly replyTo = signal<Record<string, Comment | null>>({});
  readonly reacting = signal<Set<string>>(new Set());
  readonly pickerFor = signal<string | null>(null);
  readonly sendingComment = signal<Set<string>>(new Set());
  readonly deleting = signal<Set<string>>(new Set());

  readonly greeting = computed(() =>
    this.i18n.t('greeting', { name: this.auth.profile()?.firstName || this.auth.displayName() }),
  );

  constructor() {
    this.load();
    if (!this.auth.profile()) {
      this.auth.loadProfile();
    }
  }

  ngOnDestroy(): void {
    this.revokePreview(this.composerPreview());
    Object.values(this.commentPreviews()).forEach((url) => this.revokePreview(url));
  }

  load(): void {
    this.loading.set(true);
    this.feed.getFeed().subscribe({
      next: (posts) => {
        this.posts.set(posts);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  postImage(relative: string | null | undefined): string | null {
    return this.feed.imageUrl(relative);
  }

  isMine(post: Post): boolean {
    const myUserId = this.auth.myUserId();
    return !!myUserId && post.authorId.toLowerCase() === myUserId.toLowerCase();
  }

  topEmojis(post: Post): string {
    return topReactionEmojis(post.reactionCounts);
  }

  myEmoji(post: Post): string {
    return reactionEmoji(post.myReaction);
  }

  totalReactions(post: Post): number {
    const sum = Object.values(post.reactionCounts ?? {}).reduce((total, count) => total + count, 0);
    return post.totalReactions || sum;
  }

  onComposerInput(value: string): void {
    this.composerText.set(value);
  }

  onComposerFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.error.set(this.i18n.t('image_too_big'));
      return;
    }
    this.revokePreview(this.composerPreview());
    this.composerFile.set(file);
    this.composerPreview.set(URL.createObjectURL(file));
  }

  clearComposerFile(): void {
    this.revokePreview(this.composerPreview());
    this.composerFile.set(null);
    this.composerPreview.set(null);
  }

  publish(): void {
    if (this.publishing()) {
      return;
    }
    const text = this.composerText().trim();
    const file = this.composerFile();
    if (!text && !file) {
      this.error.set(this.i18n.t('post_empty'));
      return;
    }
    this.publishing.set(true);
    this.error.set(null);

    const create = (imageUrl: string | null): void => {
      this.feed.createPost(text || null, imageUrl).subscribe({
        next: () => {
          this.composerText.set('');
          this.clearComposerFile();
          this.publishing.set(false);
          this.load();
        },
        error: (error: unknown) => {
          this.publishing.set(false);
          this.error.set(this.messageOf(error));
        },
      });
    };

    if (file) {
      this.feed.uploadImage(file).subscribe({
        next: (imageUrl) => create(imageUrl),
        error: (error: unknown) => {
          this.publishing.set(false);
          this.error.set(this.messageOf(error));
        },
      });
    } else {
      create(null);
    }
  }

  openPicker(postId: string): void {
    this.pickerFor.set(this.pickerFor() === postId ? null : postId);
  }

  closePicker(): void {
    this.pickerFor.set(null);
  }

  /** Fecha o seletor quando o clique acontece fora da área de reactions. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.reaction-wrap')) {
      this.closePicker();
    }
  }

  quickReact(post: Post): void {
    this.react(post, post.myReaction === 'heart' ? null : 'heart');
  }

  react(post: Post, kind: string | null): void {
    if (this.reacting().has(post.id)) {
      return;
    }
    this.reacting.set(this.withSet(this.reacting(), post.id, true));
    this.pickerFor.set(null);
    this.feed.setReaction(post.id, kind).subscribe({
      next: (result) => {
        this.posts.update((posts) =>
          posts.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  myReaction: result.myReaction,
                  totalReactions: result.totalReactions,
                  reactionCounts: result.counts ?? {},
                }
              : item,
          ),
        );
        this.reacting.set(this.withSet(this.reacting(), post.id, false));
      },
      error: (error: unknown) => {
        this.reacting.set(this.withSet(this.reacting(), post.id, false));
        this.error.set(this.messageOf(error));
      },
    });
  }

  toggleComments(post: Post): void {
    const isOpen = this.expanded().has(post.id);
    this.expanded.set(this.withSet(this.expanded(), post.id, !isOpen));
    if (!isOpen && !this.comments()[post.id]) {
      this.loadComments(post.id);
    }
  }

  loadComments(postId: string): void {
    if (this.commentsLoading().has(postId)) {
      return;
    }
    this.commentsLoading.set(this.withSet(this.commentsLoading(), postId, true));
    this.feed.getComments(postId).subscribe({
      next: (comments) => {
        this.comments.set({ ...this.comments(), [postId]: comments });
        this.commentsLoading.set(this.withSet(this.commentsLoading(), postId, false));
      },
      error: (error: unknown) => {
        this.commentsLoading.set(this.withSet(this.commentsLoading(), postId, false));
        this.error.set(this.messageOf(error));
      },
    });
  }

  commentInput(postId: string): string {
    return this.commentInputs()[postId] ?? '';
  }

  onCommentInput(postId: string, value: string): void {
    this.commentInputs.set({ ...this.commentInputs(), [postId]: value });
  }

  commentPreview(postId: string): string | null {
    return this.commentPreviews()[postId] ?? null;
  }

  onCommentFile(postId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.error.set(this.i18n.t('image_too_big'));
      return;
    }
    this.revokePreview(this.commentPreviews()[postId] ?? null);
    this.commentFiles.set({ ...this.commentFiles(), [postId]: file });
    this.commentPreviews.set({ ...this.commentPreviews(), [postId]: URL.createObjectURL(file) });
  }

  clearCommentFile(postId: string): void {
    this.revokePreview(this.commentPreviews()[postId] ?? null);
    this.commentFiles.set({ ...this.commentFiles(), [postId]: null });
    this.commentPreviews.set({ ...this.commentPreviews(), [postId]: null });
  }

  setReplyTo(postId: string, comment: Comment | null): void {
    this.replyTo.set({ ...this.replyTo(), [postId]: comment });
  }

  replyTarget(postId: string): Comment | null {
    return this.replyTo()[postId] ?? null;
  }

  submitComment(post: Post): void {
    const postId = post.id;
    if (this.sendingComment().has(postId)) {
      return;
    }
    const text = this.commentInput(postId).trim();
    const file = this.commentFiles()[postId] ?? null;
    if (!text && !file) {
      return;
    }
    const parent = this.replyTarget(postId);
    this.sendingComment.set(this.withSet(this.sendingComment(), postId, true));

    const send = (content: string): void => {
      this.feed.addComment(postId, content, parent?.id ?? null).subscribe({
        next: () => {
          this.commentInputs.set({ ...this.commentInputs(), [postId]: '' });
          this.clearCommentFile(postId);
          this.replyTo.set({ ...this.replyTo(), [postId]: null });
          this.sendingComment.set(this.withSet(this.sendingComment(), postId, false));
          this.posts.update((posts) =>
            posts.map((item) =>
              item.id === postId ? { ...item, commentCount: item.commentCount + 1 } : item,
            ),
          );
          this.loadComments(postId);
        },
        error: (error: unknown) => {
          this.sendingComment.set(this.withSet(this.sendingComment(), postId, false));
          this.error.set(this.messageOf(error));
        },
      });
    };

    if (file) {
      this.feed.uploadImage(file).subscribe({
        next: (imageUrl) => send(text ? `${text}\n${imageUrl}` : imageUrl),
        error: (error: unknown) => {
          this.sendingComment.set(this.withSet(this.sendingComment(), postId, false));
          this.error.set(this.messageOf(error));
        },
      });
    } else {
      send(text);
    }
  }

  deletePost(post: Post): void {
    if (this.deleting().has(post.id)) {
      return;
    }
    if (!confirm(this.i18n.t('delete_post_confirm'))) {
      return;
    }
    this.deleting.set(this.withSet(this.deleting(), post.id, true));
    this.feed.deletePost(post.id).subscribe({
      next: () => {
        this.posts.update((posts) => posts.filter((item) => item.id !== post.id));
        this.deleting.set(this.withSet(this.deleting(), post.id, false));
      },
      error: (error: unknown) => {
        this.deleting.set(this.withSet(this.deleting(), post.id, false));
        this.error.set(this.messageOf(error));
      },
    });
  }

  partsOf(content: string): { text: string; images: string[] } {
    return splitContent(content);
  }

  resolveImage(token: string): string {
    return this.feed.imageUrl(token) ?? token;
  }

  commentName(comment: Comment | null): string {
    return comment?.authorName ?? '';
  }

  private withSet(current: Set<string>, id: string, add: boolean): Set<string> {
    const next = new Set(current);
    if (add) {
      next.add(id);
    } else {
      next.delete(id);
    }
    return next;
  }

  private revokePreview(url: string | null): void {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  private messageOf(error: unknown): string {
    if (!(error instanceof ApiError) || error.message === 'network') {
      return this.i18n.t('network_error');
    }
    return error.message || this.i18n.t('error_generic');
  }
}
