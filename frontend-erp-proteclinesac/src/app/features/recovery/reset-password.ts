import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-reset-password',
  styleUrl: './recovery.scss',
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  readonly error = signal<string | null>(null);
  readonly done = signal(false);
  readonly form = new FormGroup({
    token: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { token, newPassword } = this.form.getRawValue();
    this.error.set(null);
    this.auth.resetPassword(token, newPassword).subscribe({
      next: () => {
        this.done.set(true);
        setTimeout(() => void this.router.navigate(['/ingresar']), 1200);
      },
      error: (response) =>
        this.error.set(response.error?.message ?? 'No fue posible restablecer la contraseña.'),
    });
  }
}
