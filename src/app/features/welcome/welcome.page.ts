import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../core/utils';
import { MusicService } from '../../core/audio/music.service';
import { AuthService, RegisterOutcome } from '../../core/auth/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ModalComponent } from '../../shared/modal.component';
import { IconComponent } from '../../shared/icon.component';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-welcome',
  imports: [ModalComponent, IconComponent],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss',
})
export class WelcomePage implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly music = inject(MusicService);
  private readonly router = inject(Router);

  readonly mode = signal<AuthMode>('login');
  readonly showForm = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly email = signal('');
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly password = signal('');

  readonly isRegister = computed(() => this.mode() === 'register');
  readonly canSubmit = computed(
    () =>
      this.email().trim().length > 0 &&
      this.password().length >= 6 &&
      (!this.isRegister() ||
        (this.firstName().trim().length > 0 && this.lastName().trim().length > 0)),
  );

  readonly frame = signal(0);
  private readonly frames = Array.from({ length: 8 }, (_, index) => `assets/fighter_k${index}.png`);
  private frameTimers: ReturnType<typeof setTimeout>[] = [];
  private kickTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.preloadFrames();
    this.kickTimer = setInterval(() => this.playKick(), 4200);
    setTimeout(() => this.playKick(), 900);
  }

  ngOnDestroy(): void {
    this.frameTimers.forEach((timer) => clearTimeout(timer));
    if (this.kickTimer) {
      clearInterval(this.kickTimer);
    }
    this.music.stop();
  }

  toggleMusic(): void {
    this.music.toggle();
  }

  frameSrc(): string {
    return this.frames[this.frame()] ?? this.frames[0];
  }

  openForm(mode: AuthMode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.success.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    if (this.loading()) {
      return;
    }
    this.showForm.set(false);
    this.error.set(null);
    this.success.set(null);
    this.password.set('');
  }

  switchMode(): void {
    this.mode.set(this.isRegister() ? 'login' : 'register');
    this.error.set(null);
    this.success.set(null);
  }

  submit(): void {
    if (!this.canSubmit() || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    if (this.isRegister()) {
      this.auth
        .register(this.email(), this.firstName(), this.lastName(), this.password())
        .subscribe({
          next: (outcome: RegisterOutcome) => {
            this.loading.set(false);
            if (outcome === 'loggedIn') {
              void this.router.navigate(['/feed']);
            } else {
              this.mode.set('login');
              this.password.set('');
              this.success.set(this.i18n.t('account_created_login'));
            }
          },
          error: (error: unknown) => {
            this.loading.set(false);
            this.error.set(this.messageOf(error));
          },
        });
    } else {
      this.auth.login(this.email(), this.password()).subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigate(['/feed']);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(this.messageOf(error));
        },
      });
    }
  }

  private messageOf(error: unknown): string {
    const parsed = error instanceof ApiError ? error : null;
    if (!parsed || parsed.message === 'network') {
      return this.i18n.t('network_error');
    }
    return parsed.message || this.i18n.t('error_generic');
  }

  private playKick(): void {
    this.frameTimers.forEach((timer) => clearTimeout(timer));
    this.frameTimers = [];
    for (let index = 1; index <= 7; index += 1) {
      this.frameTimers.push(setTimeout(() => this.frame.set(index), index * 95));
    }
    this.frameTimers.push(setTimeout(() => this.frame.set(0), 8 * 95));
  }

  private preloadFrames(): void {
    this.frames.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }
}
