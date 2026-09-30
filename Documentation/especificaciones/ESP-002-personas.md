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
npm --prefix backend-erp-proteclinesac run prisma:generate
npm --prefix backend-erp-proteclinesac run prisma:migrate:deploy
npm --prefix backend-erp-proteclinesac run build
npm --prefix frontend-erp-proteclinesac run build
```

Reiniciar el backend y actualizar la sesión en el navegador para ver el enlace Personas en Inicio. No es necesario volver a ejecutar el seed sobre una instalación existente.

## Comprobaciones

Pruebas unitarias de validación y autorización: `npm --prefix backend-erp-proteclinesac test`.
Pruebas de API con PostgreSQL: `npm --prefix backend-erp-proteclinesac run test:people` (requiere TEST_DATABASE_URL local y distinta de desarrollo; usa registros temporales propios).
Pruebas de interfaz: `npm --prefix frontend-erp-proteclinesac test -- --watch=false`.

## Listas personales y ubicación geográfica

Género es obligatorio en la ficha personal y se selecciona entre Masculino y Femenino. Estado civil ofrece Soltero/a, Casado/a, Divorciado/a y Viudo/a. Las formas anteriores se agrupan al editar; los géneros anteriores que no coincidan con las opciones requieren una nueva selección.

El catálogo de Perú 2016 se integra en `backend-erp-proteclinesac/src/modules/people/data/ubigeo_peru_2016.json` y se incluye en la compilación del backend. Es una copia histórica de los tres PHP proporcionados, con 25 departamentos, 196 provincias y 1874 distritos. La API autenticada `GET /people/ubigeo` entrega esa jerarquía al formulario.

País se muestra como Perú en un campo de solo lectura. Se seleccionan departamento, provincia y distrito en orden. Cambiar un padre limpia sus selecciones dependientes. La ubicación sigue siendo opcional, pero una selección iniciada debe completarse. La interfaz reemplaza Ciudad / localidad por Referencia, un texto opcional de hasta 300 caracteres que se guarda separado de Dirección. Los valores antiguos de ciudad se conservan en los datos existentes.

La migración `20260930162000_add_people_ubigeo` incorpora departamento, provincia y UBIGEO a las fichas. El código distrital se guarda como texto de seis dígitos, conservando los ceros iniciales. La API valida que exista y que los nombres enviados correspondan a él; cuando solo se envía el código, obtiene los nombres del catálogo. Los domicilios antiguos sin código no reciben uno automáticamente.

La migración `20260930165000_add_people_reference` añade el campo Referencia. Género se valida como obligatorio también en la API; los familiares mantienen su género opcional.
