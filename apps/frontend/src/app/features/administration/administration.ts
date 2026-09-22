import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdministrationService,
  AuditEvent,
  ManagedRole,
  ManagedUser,
  Permission,
} from './administration.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-administration',
  styleUrl: './administration.scss',
  templateUrl: './administration.html',
})
export class Administration implements OnInit {
  readonly users = signal<ManagedUser[]>([]);
  readonly roles = signal<ManagedRole[]>([]);
  readonly permissions = signal<Permission[]>([]);
  readonly auditEvents = signal<AuditEvent[]>([]);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);
  readonly editingRoleId = signal<string | null>(null);
  readonly form = new FormGroup({
    documentNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    academicPeriod: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(9)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    roleCode: new FormControl('ESTUDIANTE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  readonly roleForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    permissionCodes: new FormControl('', { nonNullable: true }),
  });
  readonly permissionForm = new FormGroup({
    resource: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    action: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  private readonly administration = inject(AdministrationService);

  ngOnInit() {
    this.reload();
  }
  reload() {
    this.administration
      .users()
      .subscribe({ next: (users) => this.users.set(users), error: () => this.loadError() });
    this.refreshRoles();
    this.refreshPermissions();
    this.refreshAudit();
  }

  create() {
    if (this.form.invalid || this.creating()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.creating.set(true);
    this.error.set(null);
    this.administration
      .createUser({
        documentType: 'DNI',
        documentNumber: value.documentNumber,
        academicPeriod: value.academicPeriod,
        email: value.email || undefined,
        roleCodes: [value.roleCode],
      })
      .subscribe({
        next: (user) => {
          this.users.update((users) => [user, ...users]);
          this.form.reset({
            documentNumber: '',
            academicPeriod: 1,
            email: '',
            roleCode: 'ESTUDIANTE',
          });
          this.creating.set(false);
          this.refreshAudit();
        },
        error: (response) => {
          this.error.set(response.error?.message ?? 'No fue posible crear el usuario.');
          this.creating.set(false);
        },
      });
  }

  setStatus(user: ManagedUser, status: 'ACTIVA' | 'INACTIVA' | 'BLOQUEADA') {
    this.administration.updateUser(user.membershipId, { status }).subscribe({
      next: (updated) => {
        this.users.update((users) =>
          users.map((item) => (item.membershipId === updated.membershipId ? updated : item)),
        );
        this.refreshAudit();
      },
      error: () => this.error.set('No fue posible actualizar el estado de la cuenta.'),
    });
  }

  editRole(role: ManagedRole) {
    this.editingRoleId.set(role.id);
    this.roleForm.setValue({
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      permissionCodes: this.rolePermissions(role).join(', '),
    });
  }

  saveRole() {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }
    const value = this.roleForm.getRawValue();
    const input = {
      name: value.name,
      description: value.description || undefined,
      permissionCodes: this.parseCodes(value.permissionCodes),
    };
    const roleId = this.editingRoleId();
    const request = roleId
      ? this.administration.updateRole(roleId, input)
      : this.administration.createRole({ code: value.code, ...input });
    request.subscribe({
      next: () => {
        this.cancelRoleEdit();
        this.refreshRoles();
        this.refreshAudit();
      },
      error: (response) =>
        this.error.set(response.error?.message ?? 'No fue posible guardar el rol.'),
    });
  }

  toggleRole(role: ManagedRole) {
    this.administration.updateRole(role.id, { isActive: !role.isActive }).subscribe({
      next: () => {
        this.refreshRoles();
        this.refreshAudit();
      },
      error: () => this.error.set('No fue posible actualizar el rol.'),
    });
  }

  cancelRoleEdit() {
    this.editingRoleId.set(null);
    this.roleForm.reset({ code: '', name: '', description: '', permissionCodes: '' });
  }
  createPermission() {
    if (this.permissionForm.invalid) {
      this.permissionForm.markAllAsTouched();
      return;
    }
    const value = this.permissionForm.getRawValue();
    this.administration.createPermission(value.resource, value.action).subscribe({
      next: () => {
        this.permissionForm.reset({ resource: '', action: '' });
        this.refreshPermissions();
        this.refreshAudit();
      },
      error: (response) =>
        this.error.set(response.error?.message ?? 'No fue posible crear el permiso.'),
    });
  }

  roleNames(user: ManagedUser) {
    return user.roles.map((role) => role.name).join(', ');
  }
  rolePermissions(role: ManagedRole) {
    return role.permissions.map(({ permission }) => `${permission.resource}.${permission.action}`);
  }
  eventActor(event: AuditEvent) {
    return event.actorUser?.email ?? event.actorUser?.documentNumber ?? 'Sistema';
  }
  private parseCodes(value: string) {
    return value
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);
  }
  private refreshRoles() {
    this.administration
      .roles()
      .subscribe({ next: (roles) => this.roles.set(roles), error: () => this.loadError() });
  }
  private refreshPermissions() {
    this.administration.permissions().subscribe({
      next: (permissions) => this.permissions.set(permissions),
      error: () => this.loadError(),
    });
  }
  private refreshAudit() {
    this.administration
      .audit()
      .subscribe({ next: (events) => this.auditEvents.set(events), error: () => this.loadError() });
  }
  private loadError() {
    this.error.set('No fue posible cargar una sección de administración. Verifica tus permisos.');
  }
}
