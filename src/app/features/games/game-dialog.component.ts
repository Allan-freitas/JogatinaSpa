import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Friend, GAME_STATUSES, GameStatus } from '../../data/models';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

export interface GameDialogResult {
  status: GameStatus;
  favorite: boolean;
  friendIds: string[];
  cover: File | null;
}

@Component({
  selector: 'app-game-dialog',
  imports: [ModalComponent, IconComponent],
  templateUrl: './game-dialog.component.html',
  styleUrl: './game-dialog.component.scss',
})
export class GameDialogComponent implements OnInit {
  readonly i18n = inject(I18nService);

  readonly title = input.required<string>();
  readonly initialStatus = input<GameStatus>('Wishlist');
  readonly initialFavorite = input(false);
  readonly isUpdate = input(false);
  readonly conflictMessage = input<string | null>(null);
  readonly busy = input(false);
  readonly coverUrl = input<string | null>(null);
  readonly allowCover = input(false);
  readonly friends = input<Friend[]>([]);
  readonly showFriendPicker = input(false);

  readonly confirmed = output<GameDialogResult>();
  readonly closed = output<void>();

  readonly statuses = GAME_STATUSES;
  readonly status = signal<GameStatus>('Wishlist');
  readonly favorite = signal(false);
  readonly selectedFriends = signal<Set<string>>(new Set());
  readonly coverFile = signal<File | null>(null);
  readonly coverPreview = signal<string | null>(null);
  readonly coverError = signal<string | null>(null);

  readonly previewUrl = computed(() => this.coverPreview() ?? this.coverUrl());
  readonly hasCover = computed(() => !!this.previewUrl());

  ngOnInit(): void {
    this.status.set(this.initialStatus());
    this.favorite.set(this.initialFavorite());
  }

  setStatus(value: GameStatus): void {
    this.status.set(value);
  }

  toggleFavorite(): void {
    this.favorite.update((value) => !value);
  }

  toggleFriend(friendId: string): void {
    const next = new Set(this.selectedFriends());
    if (next.has(friendId)) {
      next.delete(friendId);
    } else {
      next.add(friendId);
    }
    this.selectedFriends.set(next);
  }

  onCoverPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.coverError.set(this.i18n.t('image_too_big'));
      return;
    }
    this.coverError.set(null);
    if (this.coverPreview()) {
      URL.revokeObjectURL(this.coverPreview()!);
    }
    this.coverFile.set(file);
    this.coverPreview.set(URL.createObjectURL(file));
  }

  confirm(): void {
    this.confirmed.emit({
      status: this.status(),
      favorite: this.favorite(),
      friendIds: [...this.selectedFriends()],
      cover: this.coverFile(),
    });
  }

  close(): void {
    if (this.busy()) {
      return;
    }
    if (this.coverPreview()) {
      URL.revokeObjectURL(this.coverPreview()!);
    }
    this.closed.emit();
  }
}
