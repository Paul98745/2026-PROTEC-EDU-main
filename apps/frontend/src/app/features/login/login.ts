import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, FormControl, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup({
    institutionCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    studentCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  submit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.submitting.set(true);
    const { institutionCode, studentCode, password } = this.form.getRawValue();
    this.auth.login(institutionCode, studentCode, password).subscribe({
      next: ({ user }) => {
        void this.router.navigate([user.mustChangePassword ? '/cambiar-contrasena' : '/inicio']);
      },
      error: () => {
        this.error.set(
          'No fue posible ingresar con esos datos. Verifica la información e inténtalo otra vez.',
        );
        this.submitting.set(false);
      },
    });
  }
}
