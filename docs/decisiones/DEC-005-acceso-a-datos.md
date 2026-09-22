# DEC-005 — Acceso a datos

**Estado:** ACEPTADA
**Versión:** 1.0
**Fecha:** 2026-09-11

## Decisión

Usar Prisma ORM 7.10.0 y `@prisma/client` 7.10.0 como herramienta de acceso a PostgreSQL para ProtecEdu.

## Contexto

DEC-002 aprobó NestJS y PostgreSQL, pero dejó pendiente la herramienta de acceso a datos. El sistema requerirá relaciones explícitas entre usuarios, roles, permisos, instituciones y eventos de auditoría.

## Alternativas evaluadas

### Prisma

- Proporciona un esquema centralizado, cliente generado y consultas tipadas.
- Incluye migraciones versionadas y soporte estable para PostgreSQL.
- Se adapta a relaciones explícitas y a una estructura modular de NestJS mediante infraestructura compartida.

### TypeORM

- Se integra mediante decoradores y repositorios propios de NestJS.
- Requiere mayor disciplina para mantener entidades, migraciones y configuración sincronizadas.
- No ofrece la misma experiencia de cliente generado y tipado de consultas que Prisma para esta etapa.

## Consecuencias

- Prisma se configura en `apps/backend/prisma/` y `apps/backend/prisma.config.ts`.
- El bootstrap no crea modelos de dominio ni migraciones.
- Prisma 7 se mantiene fijado en la línea 7.x; no se actualizarán majors automáticamente.
- Una actualización futura a Prisma 8 requerirá una decisión técnica explícita antes de modificar dependencias o configuración.
