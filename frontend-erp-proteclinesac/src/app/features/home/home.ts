import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home implements OnInit {
  readonly loading = signal(true);

  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.auth.me().subscribe({
      next: (user) => {
        this.loading.set(false);
        if (user.mustChangePassword) {
          void this.router.navigate(['/cambiar-contrasena']);
        }
      },
      error: () => {
        this.auth.user.set(null);
        void this.router.navigate(['/ingresar']);
      },
    });
  }
}
