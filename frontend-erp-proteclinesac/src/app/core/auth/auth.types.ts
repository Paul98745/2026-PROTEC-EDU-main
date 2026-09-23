export interface AuthenticatedUser {
  id: string;
  institution: { code: string; name: string };
  studentCode: string | null;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
  isSuperAdministrator?: boolean;
}
