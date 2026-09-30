import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../theme/theme.service';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FormsModule],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly menuOpen = signal(false);
  readonly leaving = signal(false);
  private readonly router = inject(Router);

  logout() {
    this.leaving.set(true);
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/ingresar']),
      error: () => {
        this.auth.user.set(null);
        void this.router.navigate(['/ingresar']);
      },
    });
  }
}
