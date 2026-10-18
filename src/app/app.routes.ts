import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'welcome',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/welcome/welcome.page').then((module) => module.WelcomePage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((module) => module.ShellComponent),
    children: [
      {
        path: 'feed',
        loadComponent: () => import('./features/feed/feed.page').then((module) => module.FeedPage),
      },
      {
        path: 'library',
        loadComponent: () =>
          import('./features/games/library.page').then((module) => module.LibraryPage),
      },
      {
        path: 'catalog',
        loadComponent: () =>
          import('./features/games/catalog.page').then((module) => module.CatalogPage),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.page').then(
            (module) => module.NotificationsPage,
          ),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/chat/chat-layout.page').then((module) => module.ChatLayoutPage),
        children: [
          {
            path: 'new/:friendId',
            loadComponent: () =>
              import('./features/chat/conversation.page').then((module) => module.ConversationPage),
          },
          {
            path: ':conversationId',
            loadComponent: () =>
              import('./features/chat/conversation.page').then((module) => module.ConversationPage),
          },
        ],
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.page').then((module) => module.ProfilePage),
      },
      {
        path: 'friends',
        loadComponent: () =>
          import('./features/social/friends.page').then((module) => module.FriendsPage),
      },
      {
        path: 'users/:userId',
        loadComponent: () =>
          import('./features/profile/author-profile.page').then(
            (module) => module.AuthorProfilePage,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'feed' },
    ],
  },
  { path: '**', redirectTo: '' },
];
