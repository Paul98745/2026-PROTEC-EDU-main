import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const apiUrl = 'http://localhost:3000';

export interface ManagedUser {
  membershipId: string;
  studentCode: string | null;
  membershipActive: boolean;
  user: {
    id: string;
    documentType: string | null;
    documentNumber: string | null;
    email: string | null;
    status: 'ACTIVA' | 'INACTIVA' | 'BLOQUEADA';
    mustChangePassword: boolean;
    isSuperAdministrator: boolean;
  };
  roles: { code: string; name: string }[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface ManagedRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: { permission: Permission }[];
}

export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: string | null;
  occurredAt: string;
  institution: { code: string; name: string } | null;
  actorUser: { email: string | null; documentNumber: string | null } | null;
}

@Injectable({ providedIn: 'root' })
export class AdministrationService {
  private readonly http = inject(HttpClient);
  private readonly options = { withCredentials: true };

  users() {
    return this.http.get<ManagedUser[]>(`${apiUrl}/admin/users`, this.options);
  }
  roles() {
    return this.http.get<ManagedRole[]>(`${apiUrl}/admin/roles`, this.options);
  }
  permissions() {
    return this.http.get<Permission[]>(`${apiUrl}/admin/permissions`, this.options);
  }
  audit() {
    return this.http.get<AuditEvent[]>(`${apiUrl}/admin/audit`, this.options);
  }

  createUser(input: {
    documentType: string;
    documentNumber: string;
    academicPeriod: number;
    email?: string;
    roleCodes: string[];
  }) {
    return this.http.post<ManagedUser>(`${apiUrl}/admin/users`, input, this.options);
  }

  updateUser(
    membershipId: string,
    input: { status?: string; roleCodes?: string[]; email?: string },
  ) {
    return this.http.patch<ManagedUser>(
      `${apiUrl}/admin/users/${membershipId}`,
      input,
      this.options,
    );
  }

  createRole(input: {
    code: string;
    name: string;
    description?: string;
    permissionCodes: string[];
  }) {
    return this.http.post<ManagedRole>(`${apiUrl}/admin/roles`, input, this.options);
  }

  updateRole(
    roleId: string,
    input: { name?: string; description?: string; isActive?: boolean; permissionCodes?: string[] },
  ) {
    return this.http.patch<ManagedRole>(`${apiUrl}/admin/roles/${roleId}`, input, this.options);
  }

  createPermission(resource: string, action: string) {
    return this.http.post<Permission>(
      `${apiUrl}/admin/permissions`,
      { resource, action },
      this.options,
    );
  }
}
