# Bootstrap técnico de Fase 1

## Versiones registradas

- Node.js: 22.22.3
- npm: 10.9.9
- Angular CLI: 22.1.8
- Angular: 22.1.6
- Nest CLI: 12.0.0
- NestJS platform-express: 12.0.1
- Prisma, `@prisma/client` y `@prisma/adapter-pg`: 7.10.0

Los archivos `package-lock.json` registran las versiones concretas instaladas. Las actualizaciones mayores requieren una decisión técnica explícita.

## Aplicaciones

- `apps/frontend`: Angular standalone con routing, SCSS, modo estricto y sin SSR. Incluye inicio de sesión, recuperación, cambio obligatorio de contraseña y una vista inicial protegida.
- `apps/backend`: NestJS en modo estricto. Expone autenticación mediante sesión opaca en cookie HTTP-only, cierre de sesión, perfil actual, cambio de contraseña y recuperación local de contraseña.

El frontend reserva `core/`, `shared/` y `features/`. El backend reserva `config/`, `modules/` y `shared/database/`.

## Configuración

El backend valida `NODE_ENV`, `PORT` y, si se proporciona, `DATABASE_URL`. Las pruebas unitarias no requieren una base de datos externa.

El archivo `.env.example` es la plantilla segura. Cree `apps/backend/.env` únicamente cuando se disponga de una conexión PostgreSQL real; el archivo está ignorado por Git.

## PostgreSQL

Prisma 7 usa dos migraciones versionadas: identidad/autorización/auditoría y sesiones/restablecimiento de contraseña. `npm run db:check` desde `apps/backend` abre una conexión, ejecuta `SELECT 1` y la cierra sin modificar datos ni esquema.

La instancia local queda configurada mediante `apps/setup-protecedu-postgres.ps1`. No se incluye Docker en este bootstrap.

## Modelo base de datos

El modelo base de identidad, autorización y auditoría se define en [DEC-006](../decisiones/DEC-006-modelo-base-identidad-autorizacion.md). Usa `User` como identidad global y `InstitutionMembership` como vínculo institucional; los roles son institucionales en esta etapa.

Las bases locales deben permanecer separadas: `protecedu_dev` para desarrollo, `protecedu_shadow` para Prisma Migrate y `protecedu_test` para integración. Sus URL se configuran mediante `DATABASE_URL`, `SHADOW_DATABASE_URL` y `TEST_DATABASE_URL` respectivamente.

Las migraciones se revisan y se prueban primero contra `protecedu_test`; una vez validadas se aplican con `prisma migrate deploy` al entorno de desarrollo. El seed local se ejecuta con `npm --prefix apps/backend run db:seed`.

## Verificación local

```text
npm --prefix apps/frontend run build
npm --prefix apps/backend run build
npm --prefix apps/frontend run test -- --watch=false
npm --prefix apps/backend run test
npm --prefix apps/backend run test:integration
npm --prefix apps/frontend run lint
npm --prefix apps/backend run lint
npm --prefix apps/frontend run format:check
npm --prefix apps/backend run format:check
npm --prefix apps/backend run prisma:status
```
