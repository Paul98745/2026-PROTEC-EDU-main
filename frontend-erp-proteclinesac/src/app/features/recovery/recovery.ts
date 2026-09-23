import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-recovery',
  styleUrl: './recovery.scss',
  templateUrl: './recovery.html',
})
export class Recovery {
  readonly sent = signal(false);
  readonly developmentToken = signal<string | null>(null);
  readonly form = new FormGroup({
    institutionCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    studentCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly auth = inject(AuthService);

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { institutionCode, studentCode } = this.form.getRawValue();
    this.auth.requestPasswordReset(institutionCode, studentCode).subscribe({
      next: (result) => {
        this.sent.set(true);
        this.developmentToken.set(result.developmentToken ?? null);
      },
      error: () => this.sent.set(true),
    });
  }
}
