import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../core/api.service';
import { fileExtension } from '../core/utils';
import { Comment, Post, ReactionResult } from './models';

@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly api = inject(ApiService);

  getFeed(page = 1, pageSize = 20): Observable<Post[]> {
    return this.api.get<Post[]>(`feed/posts?page=${page}&pageSize=${pageSize}`).pipe(
      map((posts) =>
        posts.map((post) => ({
          ...post,
          authorName: post.authorName || 'Jogador',
          authorPhotoUrl: post.authorPhotoUrl || null,
          content: post.content || null,
          imageUrl: post.imageUrl || null,
          reactionCounts: post.reactionCounts ?? {},
          myReaction: post.myReaction || null,
        })),
      ),
    );
  }

  createPost(content: string | null, imageUrl: string | null): Observable<string> {
    return this.api.post<string>('feed/posts', {
      ...(content ? { content } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    });
  }

  uploadImage(file: File): Observable<string> {
    return this.api
      .upload<{ imageUrl: string }>('feed/images', this.renamedFile(file))
      .pipe(map((response) => response.imageUrl));
  }

  setReaction(postId: string, kind: string | null): Observable<ReactionResult> {
    return this.api.post<ReactionResult>(
      `feed/posts/${postId}/likes`,
      kind ? { reaction: kind } : {},
    );
  }

  getComments(postId: string): Observable<Comment[]> {
    return this.api.get<Comment[]>(`feed/posts/${postId}/comments`).pipe(
      map((comments) =>
        comments.map((comment) => ({
          ...comment,
          authorName: comment.authorName || 'Jogador',
          authorPhotoUrl: comment.authorPhotoUrl || null,
          replies: (comment.replies ?? []).map((reply) => ({
            ...reply,
            authorName: reply.authorName || 'Jogador',
            authorPhotoUrl: reply.authorPhotoUrl || null,
            replies: [],
          })),
        })),
      ),
    );
  }

  addComment(postId: string, content: string, parentCommentId: string | null): Observable<string> {
    return this.api.post<string>(`feed/posts/${postId}/comments`, {
      content,
      ...(parentCommentId ? { parentCommentId } : {}),
    });
  }

  deletePost(postId: string): Observable<string> {
    return this.api.delete<string>(`feed/posts/${postId}`);
  }

  imageUrl(relative: string | null | undefined): string | null {
    return this.api.absoluteUrl(relative);
  }

  private renamedFile(file: File): File {
    const extension = fileExtension(file.type);
    const name = file.name?.includes('.') ? file.name : `upload.${extension}`;
    return new File([file], name, { type: file.type || 'image/jpeg' });
  }
}
