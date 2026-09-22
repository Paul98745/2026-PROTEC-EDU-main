# Módulo de Personas

Implementa el Documento Técnico de Requisitos Módulo Personas mediante Angular, NestJS y PostgreSQL. La ruta de interfaz es `/personas` y la API usa `/people`.

## Alcance y decisiones

- Una ficha pertenece a la institución de la sesión, incluso para el superadministrador. El documento es único por institución.
- Un perfil principal: COLABORADOR, DOCENTE o ALUMNO. El perfil describe el vínculo; los permisos continúan definidos por los roles de la cuenta.
- Primer nombre, primer apellido, tipo y número de documento, perfil, estado y fecha de activación son obligatorios. Los demás datos personales, contacto y familiares son opcionales.
- Los documentos pueden completarse después del registro, según el criterio confirmado para esta versión. Alumnos no pueden cargar documentos laborales (recibo de luz, CV, Certijoven y certificado de estudios). Identificación, foto carnet y documentos de hijos siguen disponibles.
- DNI: 8 dígitos; RUC: 11 dígitos. Se valida formato, no autenticidad ni consulta a registros externos. CE: 9–12 caracteres alfanuméricos; pasaporte: 6–20, como límites operativos de esta primera versión.
- Se admite un padre, una madre y varios hijos (máximo 30 familiares por ficha). Cada familiar registrado requiere nombres, apellidos y documento. La foto del documento del hijo es opcional.
- Vinculación opcional con una cuenta existente de la misma institución y el mismo documento. No se crean cuentas ni se asignan roles automáticamente. El estado de la ficha no modifica el estado de acceso. Las cuentas existentes no se convierten automáticamente en fichas porque faltan nombres y apellidos.
- El correo institucional se asigna manualmente. No se provisionan buzones.

## Archivos

Un archivo por petición multipart con campos `file`, `kind` y, para DOCUMENTO_HIJO, `relativeId`. Se admiten JPG, PNG y PDF de hasta 5 MiB, verificando extensión, MIME declarado y firma inicial. Esta comprobación no sustituye un análisis antivirus o la decodificación completa del contenido.

Los archivos se guardan con identificadores aleatorios en `storage/person-documents`, relativa al directorio de ejecución del backend. `PERSON_DOCUMENTS_DIR` permite configurar una ruta absoluta persistente. Debe incluirse en los respaldos junto con PostgreSQL. No se expone mediante archivos estáticos; todas las descargas requieren sesión y permiso, se entregan como adjuntos y se auditan.

Se puede eliminar un archivo con confirmación en la interfaz. Un familiar con documentos no puede eliminarse hasta retirar sus archivos. Los documentos existentes se conservan cuando cambia el perfil; no se destruyen datos automáticamente.

## Permisos y auditoría

- `people.view`: listado, detalle y descarga.
- `people.create`: registro de fichas sin cuenta vinculada.
- `people.edit`: edición, vinculación de cuentas y gestión de archivos.

La migración asigna estos permisos a los roles ADMINISTRADOR y SUPERADMINISTRADOR existentes. El seed hace lo mismo para nuevas instalaciones. RRHH u otros roles personalizados pueden recibirlos desde Administración. Para usar la pantalla, asignar `people.view` junto con los permisos de creación o edición que correspondan.

Creación y edición de ficha y familiares son transaccionales. Se auditan cambios, cargas, descargas y eliminaciones sin copiar datos personales a los metadatos de auditoría.

## Puesta en marcha

Desde la raíz del proyecto:

```powershell
npm --prefix apps/backend run prisma:generate
npm --prefix apps/backend run prisma:migrate:deploy
npm --prefix apps/backend run build
npm --prefix apps/frontend run build
```

Reiniciar el backend y actualizar la sesión en el navegador para ver el enlace Personas en Inicio. No es necesario volver a ejecutar el seed sobre una instalación existente.

## Comprobaciones

Pruebas unitarias de validación y autorización: `npm --prefix apps/backend test`.
Pruebas de API con PostgreSQL: `npm --prefix apps/backend run test:people` (requiere TEST_DATABASE_URL local y distinta de desarrollo; usa registros temporales propios).
Pruebas de interfaz: `npm --prefix apps/frontend test -- --watch=false`.
