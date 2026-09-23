# DEC-006 — Modelo base de identidad y autorización

**Estado:** ACEPTADA
**Versión:** 1.0
**Fecha:** 2026-09-11

## Decisión

Usar UUID v4 para las entidades base y modelar la identidad global, pertenencia institucional, RBAC y auditoría mediante `User`, `Institution`, `InstitutionMembership`, `Role`, `Permission`, `UserRole`, `RolePermission` y `AuditEvent`.

## Identidad e institución

- `User` representa una identidad global.
- `InstitutionMembership` representa su vínculo con una institución.
- Un usuario puede tener varias membresías futuras, pero solo una por institución.
- `studentCode` pertenece a la membresía y es único dentro de su institución.
- El modelo permite varios valores `NULL` bajo restricciones `UNIQUE` normales de PostgreSQL. Esto es intencional para email, documento y códigos de alumno no aplicables.

## Roles y permisos

- Los roles son configurables e institucionales; `Role.institutionId` es obligatorio.
- No se crea una institución global ficticia.
- El alcance global real del Superadministrador queda diferido y requerirá una decisión de extensión antes de implementarse.
- Los permisos se identifican por `resource` y `action`; su código lógico es `${resource}.${action}`.
- `UserRole` usa claves foráneas compuestas para impedir asignar roles de una institución a membresías de otra.
- `RolePermission` es una relación explícita entre rol y permiso.

## Cuenta y auditoría

- `AccountStatus` contiene `ACTIVA`, `INACTIVA` y `BLOQUEADA`.
- `AuditEvent` es append-only por convención de aplicación.
- `AuditEvent.entityId` se almacena como texto opcional para no acoplar la auditoría a UUID en toda entidad futura.
- La metadata de auditoría no debe contener contraseñas, hashes, DNI completos, tokens ni secretos.

## Restricciones de base de datos

- Prisma representa relaciones, unicidades, claves compuestas e índices.
- Los checks SQL de intentos fallidos no negativos, pares de documento coherentes e identificadores no vacíos se añaden manualmente a la migración inicial.
- Los checks manuales son: `failedLoginAttempts >= 0`; ambos campos de documento nulos o ambos definidos; y `btrim(...) <> ''` para códigos y componentes de permisos obligatorios. Los códigos de alumno se validan como no vacíos solo cuando no son nulos.
- Como Prisma no representa esos checks directamente, toda migración futura debe revisarlos y preservarlos.

## Pendientes diferidos

- Identificador de acceso para usuarios no estudiantes.
- Resolución de `studentCode + password` cuando existan varias instituciones. Antes del login multiinstitucional deberá aprobarse una estrategia como institución previa, dominio institucional, institución más código o identificador global.
- Superadministración global real.
- Cálculo funcional de permisos, autenticación, sesiones, JWT, recuperación y seeds.
