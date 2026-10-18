import { Component, computed, input } from '@angular/core';

export type IconName =
  | 'home'
  | 'star'
  | 'star-outline'
  | 'person'
  | 'group'
  | 'search'
  | 'refresh'
  | 'logout'
  | 'chat'
  | 'bell'
  | 'trash'
  | 'image'
  | 'send'
  | 'close'
  | 'check'
  | 'add'
  | 'back'
  | 'heart'
  | 'heart-outline'
  | 'cake'
  | 'place'
  | 'interests'
  | 'camera'
  | 'globe'
  | 'plus'
  | 'chevron-down'
  | 'sparkles'
  | 'gamepad'
  | 'music'
  | 'music-off';

const ICONS: Record<IconName, string[]> = {
  home: ['M3 11.4 12 4l9 7.4', 'M5.5 10v9.5h4.3v-5.8h4.4v5.8h4.3V10'],
  star: ['M12 3.6l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.1-4 5.7-.8z'],
  'star-outline': ['M12 3.6l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.1-4 5.7-.8z'],
  person: [
    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M4.5 20.5c.7-3.4 3.7-5.5 7.5-5.5s6.8 2.1 7.5 5.5',
  ],
  group: [
    'M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11z',
    'M2.8 19.5c.5-2.8 3-4.6 6.2-4.6s5.7 1.8 6.2 4.6',
    'M16 5.2a3 3 0 0 1 0 5.8',
    'M17.4 15.2c2.2.3 3.6 1.8 4 4.1',
  ],
  search: ['M10.8 18.2a7.4 7.4 0 1 0 0-14.8 7.4 7.4 0 0 0 0 14.8z', 'M16.2 16.2 21 21'],
  refresh: ['M20 11a8 8 0 1 0-2.3 6.3', 'M20 4.5V11h-6.5'],
  logout: [
    'M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14',
    'M11 12h9',
    'M17 8.5 20.5 12 17 15.5',
  ],
  chat: ['M4.5 5.5h15v10h-8.4L6.5 19v-3.5H4.5z'],
  bell: [
    'M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.2 1.5 5.2H5S6.5 14 6.5 10z',
    'M10 18.5a2.2 2.2 0 0 0 4 0',
  ],
  trash: ['M5 7h14', 'M9 7V4.8h6V7', 'M7 7l.8 12.2H16.2L17 7', 'M10.3 10.5v5.5', 'M13.7 10.5v5.5'],
  image: [
    'M4.5 5h15v14h-15z',
    'M4.5 15.5l4.3-4.3 3.5 3.5 2.7-2.7 4.5 4.5',
    'M15.4 9.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z',
  ],
  send: ['M4 12 20 4l-4 16-4.5-6.5z', 'M11.5 13.5 20 4'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  add: ['M12 5v14', 'M5 12h14'],
  back: ['M15 5l-7 7 7 7'],
  heart: [
    'M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
  ],
  'heart-outline': [
    'M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
  ],
  cake: [
    'M4.5 20.5h15',
    'M5.5 20.5v-6h13v6',
    'M5.5 17.2c1.5 1.1 3 1.1 4.5 0s3-1.1 4.5 0 3 1.1 4.5 0',
    'M9 11V8.5',
    'M12 11V7.5',
    'M15 11V8.5',
    'M9 7.5a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6z',
    'M15 7.5a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6z',
  ],
  place: [
    'M12 21s6.5-5.5 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.5 12 21 12 21z',
    'M12 12.5a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  ],
  interests: [
    'M12 4.5a3 3 0 0 0 0 6',
    'M12 4.5a3 3 0 0 1 0 6',
    'M12 10.5v9',
    'M8 19.5h8',
    'M12 6.5v.1',
  ],
  camera: [
    'M4.5 8h3l1.4-2h6.2L16.5 8h3v10.5h-15z',
    'M12 16a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 16z',
  ],
  globe: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M3.5 12h17',
    'M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  'chevron-down': ['M6 9l6 6 6-6'],
  sparkles: [
    'M12 4l1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4z',
    'M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z',
  ],
  gamepad: [
    'M7 8.5h10a4.5 4.5 0 0 1 4.3 5.8l-.7 2.3a2.3 2.3 0 0 1-3.9.8L14.5 15h-5l-2.2 2.4a2.3 2.3 0 0 1-3.9-.8l-.7-2.3A4.5 4.5 0 0 1 7 8.5z',
    'M8.5 11.5v3',
    'M7 13h3',
    'M16 12h.1',
    'M18 14h.1',
  ],
  music: [
    'M9 18V5l10-2v13',
    'M9 18a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
    'M19 16a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
  ],
  'music-off': [
    'M9 18V5l10-2v13',
    'M9 18a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
    'M19 16a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
    'M4 4l16 16',
  ],
};

@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @for (path of paths(); track $index) {
        <path [attr.d]="path" [attr.fill]="filled() ? 'currentColor' : 'none'" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        line-height: 0;
      }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly filled = input(false);

  readonly paths = computed(() => ICONS[this.name()] ?? []);
}
