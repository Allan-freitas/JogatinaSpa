import { HttpErrorResponse } from '@angular/common/http';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function parseApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    let message = '';
    if (body && typeof body === 'object') {
      const errors = (body as { errors?: unknown }).errors;
      if (Array.isArray(errors) && errors.length > 0) {
        message = errors
          .map((item) => {
            if (typeof item === 'string') {
              return item;
            }
            if (item && typeof item === 'object') {
              return (
                (item as { description?: string; message?: string }).description ??
                (item as { message?: string }).message ??
                ''
              );
            }
            return '';
          })
          .filter(Boolean)
          .join('\n');
      } else if (errors && typeof errors === 'object') {
        message = Object.values(errors as Record<string, unknown>)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
          .join('\n');
      }
      if (!message) {
        message =
          (body as { detail?: string; title?: string; message?: string }).detail ??
          (body as { title?: string }).title ??
          (body as { message?: string }).message ??
          '';
      }
    } else if (typeof body === 'string' && body.trim()) {
      message = body;
    }
    if (!message) {
      message = error.status === 0 ? 'network' : `HTTP ${error.status}`;
    }
    return new ApiError(message, error.status);
  }
  if (error instanceof Error) {
    return new ApiError(error.message, null);
  }
  return new ApiError(String(error), null);
}

export function splitContent(content: string): { text: string; images: string[] } {
  const tokens = content.split(/\s+/).filter(Boolean);
  const images = tokens.filter(isImageToken);
  const text = tokens
    .filter((token) => !isImageToken(token))
    .join(' ')
    .trim();
  return { text, images };
}

export function isImageToken(token: string): boolean {
  const clean = token.trim().replace(/^["'(]+|["'),;]+$/g, '');
  if (!clean) {
    return false;
  }
  const lower = clean.toLowerCase();
  const looksLikePath =
    clean.startsWith('/uploads/') ||
    clean.startsWith('/chat-images/') ||
    clean.startsWith('/chat/') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://');
  if (!looksLikePath) {
    return false;
  }
  return (
    lower.includes('.jpg') ||
    lower.includes('.jpeg') ||
    lower.includes('.png') ||
    lower.includes('.gif') ||
    lower.includes('.webp') ||
    clean.startsWith('/uploads/') ||
    clean.startsWith('/chat-images/') ||
    clean.startsWith('/chat/')
  );
}

export function previewText(content: string): string | null {
  const { text, images } = splitContent(content);
  if (text) {
    return text;
  }
  return images.length > 0 ? null : content;
}

export function fileExtension(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function collectDeviceInfo(): Record<string, string> {
  const ua = navigator.userAgent;
  const info: Record<string, string> = {
    platform: 'web',
    manufacturer: navigator.vendor || 'browser',
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const os =
    ua.match(/Windows NT ([\d.]+)/) ??
    ua.match(/Android ([\d.]+)/) ??
    ua.match(/iPhone OS ([\d_]+)/) ??
    ua.match(/Mac OS X ([\d_]+)/);
  if (os) {
    info['osVersion'] = `web ${os[1].replaceAll('_', '.')}`;
  }

  const browser = ua.match(/(Edg|OPR|Chrome|Firefox|Version)\/[\d.]+/);
  if (browser) {
    info['appVersion'] = browser[0].replace('Version', 'Safari');
  }

  let deviceId = localStorage.getItem('jogatina_device_id');
  if (!deviceId) {
    deviceId = uuid();
    localStorage.setItem('jogatina_device_id', deviceId);
  }
  info['deviceId'] = deviceId;

  return info;
}
