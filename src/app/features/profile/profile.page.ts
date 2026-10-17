import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../core/utils';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, flagEmoji } from '../../core/i18n/i18n.service';
import { COUNTRY_CODES } from '../../data/countries';
import { UserProfile, birthDateDisplay } from '../../data/models';
import { UsersService } from '../../data/users.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { PageHeaderComponent } from '../../shared/page-header.component';

@Component({
  selector: 'app-profile',
  imports: [AvatarComponent, IconComponent, ModalComponent, PageHeaderComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly router = inject(Router);

  readonly today = new Date().toISOString().slice(0, 10);

  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly editing = signal(false);

  readonly birthDate = signal<string | null>(null);
  readonly hobbies = signal('');
  readonly country = signal<string | null>(null);
  readonly photoFile = signal<File | null>(null);
  readonly photoPreview = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  readonly countryQuery = signal('');
  readonly countryOpen = signal(false);

  readonly birthDisplay = computed(() => birthDateDisplay(this.profile()?.birthDate ?? null));
  readonly selectedCountryLabel = computed(() => this.countryLabel(this.country()));
  readonly countries = computed(() => {
    const locale = this.i18n.language() === 'pt' ? 'pt-BR' : 'en';
    return COUNTRY_CODES.map((code) => ({
      code,
      name: this.i18n.countryName(code) ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name, locale));
  });
  readonly filteredCountries = computed(() => {
    const query = this.countryQuery().trim().toLowerCase();
    if (!query) {
      return this.countries();
    }
    return this.countries().filter(
      (country) =>
        country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.users.getMe().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
        this.error.set(null);
        this.auth.profile.set(profile);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.messageOf(error));
      },
    });
  }

  photoUrl(): string | null {
    return this.users.photoUrl(this.profile()?.photoUrl);
  }

  countryLabel(code: string | null | undefined): string {
    if (!code) {
      return this.i18n.t('not_informed');
    }
    return `${flagEmoji(code)} ${this.i18n.countryName(code) ?? code}`;
  }

  flagOf(code: string): string {
    return flagEmoji(code);
  }

  startEdit(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }
    this.birthDate.set(profile.birthDate);
    this.hobbies.set(profile.hobbies ?? '');
    this.country.set(profile.country);
    this.countryQuery.set('');
    this.countryOpen.set(false);
    this.photoFile.set(null);
    this.photoError.set(null);
    this.revokePreview(this.photoPreview());
    this.photoPreview.set(null);
    this.editing.set(true);
  }

  closeEdit(): void {
    if (this.saving()) {
      return;
    }
    this.editing.set(false);
    this.revokePreview(this.photoPreview());
    this.photoPreview.set(null);
    this.photoFile.set(null);
  }

  onPhotoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.photoError.set(this.i18n.t('image_too_big'));
      return;
    }
    this.photoError.set(null);
    this.revokePreview(this.photoPreview());
    this.photoFile.set(file);
    this.photoPreview.set(URL.createObjectURL(file));
  }

  pickCountry(code: string | null): void {
    this.country.set(code);
    this.countryOpen.set(false);
    this.countryQuery.set('');
  }

  save(): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const file = this.photoFile();
    const birth = this.birthDate();
    const hobbies = this.hobbies().trim() || null;
    const country = this.country();

    const update = (): void => {
      this.users.updateProfile(birth, hobbies, country).subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.auth.profile.set(profile);
          this.saving.set(false);
          this.editing.set(false);
          this.revokePreview(this.photoPreview());
          this.photoPreview.set(null);
          this.photoFile.set(null);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(this.messageOf(error));
        },
      });
    };

    if (file) {
      this.users.uploadPhoto(file).subscribe({
        next: () => update(),
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(this.messageOf(error));
        },
      });
    } else {
      update();
    }
  }

  openFriends(): void {
    void this.router.navigate(['/friends']);
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
