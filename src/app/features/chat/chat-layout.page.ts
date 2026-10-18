import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from '../../shared/icon.component';
import { ChatSidebarComponent } from './chat-sidebar.component';

@Component({
  selector: 'app-chat-layout',
  imports: [RouterOutlet, ChatSidebarComponent, IconComponent],
  templateUrl: './chat-layout.page.html',
  styleUrl: './chat-layout.page.scss',
})
export class ChatLayoutPage {
  readonly i18n = inject(I18nService);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUrl = signal(this.router.url);

  readonly hasActiveConversation = computed(() => {
    const url = this.currentUrl().split('?')[0];
    return url.startsWith('/chat/') && url.length > '/chat/'.length;
  });

  readonly activeConversationId = computed(() => {
    const match = /^\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
      this.currentUrl(),
    );
    return match?.[1]?.toLowerCase() ?? null;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }
}
