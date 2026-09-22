import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { catchError, map, of } from 'rxjs';

export const peopleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map((user) =>
      user.isSuperAdministrator || user.permissions.includes('people.view')
        ? true
        : router.createUrlTree(['/inicio']),
    ),
    catchError(() => of(router.createUrlTree(['/ingresar']))),
  );
};
