# ProtecEdu

ProtecEdu es el MVP local de una plataforma educativa con acceso institucional seguro.

## Arquitectura

Angular → NestJS → PostgreSQL

Arquitectura inicial: monolito modular.

## Estructura del repositorio

- `apps/frontend`: aplicación Angular de acceso, recuperación y vista inicial protegida.
- `apps/backend`: API NestJS de autenticación, sesiones, RBAC y auditoría.
- `docs`: decisiones, especificaciones, requerimientos, pruebas, arquitectura y fases.
- `scripts`: scripts auxiliares del proyecto.

## Estado

Estado de aprobación: FASE_0_APROBADA
Estado operativo: FASE_0_CERRADA
FASE_1_AUTORIZADA

## Documentación

- [Decisiones](docs/decisiones/)
- [Especificaciones](docs/especificaciones/)
- [Fases](docs/fases/)
- [Estructura futura](docs/arquitectura/estructura-futura.md)
- [Bootstrap técnico de Fase 1](docs/arquitectura/bootstrap-fase-1.md)
- [MANUAL PARA MICKYS: instalación paso a paso](docs/MANUAL%20PARA%20MICKYS.md)

## Bootstrap técnico

Requiere Node.js `>=22.22.3 <23` y npm 10.9.9.

- Frontend: `npm --prefix apps/frontend run start`
- Backend: `npm --prefix apps/backend run start:dev`
- Build frontend: `npm --prefix apps/frontend run build`
- Build backend: `npm --prefix apps/backend run build`
- Tests y lint: ejecutar los scripts equivalentes en cada aplicación.

PostgreSQL se configura localmente mediante `apps/backend/.env`, que no se versiona. Consulte `.env.example` antes de ejecutar `npm --prefix apps/backend run db:check`.

La migración inicial requiere bases de desarrollo, shadow y pruebas separadas. Para preparar un entorno local, ejecute las migraciones con `npm --prefix apps/backend run prisma:migrate:deploy` y cree el usuario de demostración con `npm --prefix apps/backend run db:seed`.

## Cuentas locales de demostración

Tras ejecutar el seed, abra `http://localhost:4200` e ingrese con la institución `DEMO-EDU` y una de estas cuentas:

| Rol | Código institucional |
| --- | --- |
| Superadministrador | `D026100001` |
| Administrador | `D026100002` |
| Colaborador | `D026100003` |
| Docente | `D026100004` |
| Estudiante | `D026100005` |

La contraseña local de todas las cuentas es `ProtecEdu!2026`.

Use `MVP_STUDENT_PASSWORD` en `apps/backend/.env` antes de ejecutar el seed para sustituir esa contraseña local.

La recuperación de contraseña entrega un código en la interfaz solo durante desarrollo. En producción envía el enlace por SMTP y exige `APP_PUBLIC_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`.
