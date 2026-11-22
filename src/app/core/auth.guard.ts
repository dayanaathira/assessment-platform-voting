import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Guards only shape navigation; the API enforces every rule on its own.

/**
 * Lets signed-in users through; others go to login and come back afterwards.
 * @param _route - Unused.
 * @param state - Target router state, used for returnUrl.
 * @returns True, or a redirect to /login.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  return (
    inject(AuthService).isLoggedIn() ||
    inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
  );
};

/**
 * Lets admins through; other users go back to the request list.
 * @returns True, or a redirect to /feature-requests.
 */
export const adminGuard: CanActivateFn = () => {
  return inject(AuthService).isAdmin() || inject(Router).createUrlTree(['/feature-requests']);
};
