import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStore } from './token.store';

export const authGuard: CanActivateFn = () => {
  const tokens = inject(TokenStore);
  const router = inject(Router);
  return tokens.isLoggedIn ? true : router.createUrlTree(['/welcome']);
};

export const guestGuard: CanActivateFn = () => {
  const tokens = inject(TokenStore);
  const router = inject(Router);
  return tokens.isLoggedIn ? router.createUrlTree(['/feed']) : true;
};
