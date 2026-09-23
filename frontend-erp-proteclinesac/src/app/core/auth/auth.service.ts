import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { AuthenticatedUser } from './auth.types';

const apiUrl = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AuthenticatedUser | null>(null);

  private readonly http = inject(HttpClient);

  login(institutionCode: string, studentCode: string, password: string) {
    return this.http
      .post<{ user: AuthenticatedUser }>(
        `${apiUrl}/auth/login`,
        { institutionCode, studentCode, password },
        { withCredentials: true },
      )
      .pipe(tap(({ user }) => this.user.set(user)));
  }

  me() {
    return this.http
      .get<AuthenticatedUser>(`${apiUrl}/auth/me`, { withCredentials: true })
      .pipe(tap((user) => this.user.set(user)));
  }

  logout() {
    return this.http
      .post<void>(`${apiUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this.user.set(null)));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http
      .post<void>(
        `${apiUrl}/auth/change-password`,
        { currentPassword, newPassword },
        { withCredentials: true },
      )
      .pipe(tap(() => this.user.set(null)));
  }

  requestPasswordReset(institutionCode: string, studentCode: string) {
    return this.http.post<{ message: string; developmentToken?: string }>(
      `${apiUrl}/auth/password-reset/request`,
      { institutionCode, studentCode },
      { withCredentials: true },
    );
  }

  resetPassword(token: string, newPassword: string) {
    return this.http.post<void>(
      `${apiUrl}/auth/password-reset/complete`,
      { token, newPassword },
      { withCredentials: true },
    );
  }
}
