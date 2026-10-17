import { Injectable, computed, signal } from '@angular/core';
import { Language, TRANSLATIONS } from './translations';

const STORAGE_KEY = 'jogatina_language';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly languageSignal = signal<Language>(this.initialLanguage());

  readonly language = this.languageSignal.asReadonly();
  readonly isPortuguese = computed(() => this.languageSignal() === 'pt');

  private displayNames: Intl.DisplayNames | null = null;

  constructor() {
    document.documentElement.lang = this.languageSignal() === 'pt' ? 'pt-BR' : 'en';
  }

  setLanguage(language: Language): void {
    this.languageSignal.set(language);
    this.displayNames = null;
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
  }

  toggle(): void {
    this.setLanguage(this.languageSignal() === 'en' ? 'pt' : 'en');
  }

  t(key: string, params?: Record<string, string | number>): string {
    const dictionary = TRANSLATIONS[this.languageSignal()];
    let value = dictionary[key] ?? TRANSLATIONS.en[key] ?? key;
    if (params) {
      for (const [name, replacement] of Object.entries(params)) {
        value = value.replaceAll(`{${name}}`, String(replacement));
      }
    }
    return value;
  }

  timeAgo(iso: string): string {
    if (!iso) {
      return '';
    }
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    const minutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60_000));
    if (minutes < 1) {
      return this.t('time_now');
    }
    if (minutes < 60) {
      return this.t('time_min', { n: minutes });
    }
    if (minutes < 60 * 24) {
      return this.t('time_hour', { n: Math.floor(minutes / 60) });
    }
    if (minutes < 60 * 24 * 7) {
      return this.t('time_day', { n: Math.floor(minutes / (60 * 24)) });
    }
    return this.formatIsoDate(iso);
  }

  formatIsoDate(iso: string): string {
    const datePart = iso.slice(0, 10);
    const parts = datePart.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : datePart;
  }

  countryName(code: string | null | undefined): string | null {
    if (!code) {
      return null;
    }
    try {
      this.displayNames ??= new Intl.DisplayNames(
        [this.languageSignal() === 'pt' ? 'pt-BR' : 'en'],
        {
          type: 'region',
        },
      );
      return this.displayNames.of(code.toUpperCase()) ?? code;
    } catch {
      return code;
    }
  }

  countryLabel(code: string | null | undefined): string {
    if (!code) {
      return this.t('not_informed');
    }
    return `${flagEmoji(code)} ${this.countryName(code) ?? code}`;
  }

  private initialLanguage(): Language {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'pt') {
      return stored;
    }
    return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  }
}

export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .split('')
    .map((letter) => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65))
    .join('');
}
