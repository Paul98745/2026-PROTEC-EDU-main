# MANUAL PARA MICKYS

Guía paso a paso para instalar y ejecutar ProtecEdu en una computadora con Windows. No necesitas conocer el proyecto antes de empezar.

## 1. Qué vas a instalar

ProtecEdu usa tres piezas:

1. **Frontend:** la página que se abre en el navegador.
2. **Backend:** la API que valida usuarios y permisos.
3. **PostgreSQL:** la base de datos local.

Al terminar, abrirás `http://localhost:4200` y podrás iniciar sesión con las cuentas de prueba.

## 2. Programas necesarios

Instala estos programas antes de continuar:

| Programa | Para qué sirve | Cómo comprobarlo |
| --- | --- | --- |
| Git | Descargar y actualizar el proyecto | `git --version` |
| Node.js 22 | Ejecutar frontend y backend | `node --version` |
| npm 10 | Instalar dependencias | `npm --version` |
| PostgreSQL 18 | Guardar los datos | Debe incluir `psql.exe` |

> El proyecto requiere Node `>=22.22.3` y `<23`. Durante la instalación de PostgreSQL, recuerda la contraseña del usuario administrador `postgres` y el puerto elegido. El manual usa el puerto `5433`.

## 3. Descargar el proyecto

Abre **PowerShell** y ejecuta:

```powershell
cd C:\Users\Administrator\Documents
git clone https://github.com/JesusEchavandi/2026-PROTEC-EDU.git
cd 2026-PROTEC-EDU
```

Comprueba que estás en el lugar correcto:

```powershell
Get-Location
Test-Path .\apps\setup-protecedu-postgres.ps1
```

El segundo comando debe responder `True`. Si responde `False`, entra primero a la carpeta `2026-PROTEC-EDU` con `cd`.

## 4. Instalar las dependencias del proyecto

Desde la carpeta principal del proyecto, ejecuta una sola vez:

```powershell
npm --prefix apps\backend install
npm --prefix apps\frontend install
```

Esto puede tardar algunos minutos. No compartas ni subas las carpetas `node_modules`; cada persona las instala en su propia computadora.

## 5. Preparar PostgreSQL y crear las bases locales

El proyecto incluye un asistente que crea:

- El usuario local `protecedu_app`.
- Las bases `protecedu_dev`, `protecedu_shadow` y `protecedu_test`.
- El archivo privado `backend-erp-proteclinesac/.env` con la conexión local.

Ejecuta este comando desde la carpeta principal:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\dba-erp-proteclinesac\setup-protecedu-postgres.ps1 -RepoRoot (Get-Location).Path -PostgresBin "C:\Program Files\PostgreSQL\18\bin" -HostName 127.0.0.1 -Port 5433
```

El asistente solicitará tres datos:

1. La contraseña del administrador de PostgreSQL, normalmente el usuario `postgres`.
2. Una contraseña nueva para `protecedu_app`.
3. La misma contraseña de `protecedu_app` para guardarla de forma local en el archivo `.env`.

No copies ese archivo `.env` a GitHub ni lo envíes por chat: contiene la contraseña de tu base de datos.

### Si PostgreSQL usa otro puerto

Si lo instalaste en `5432`, reemplaza solamente `-Port 5433` por `-Port 5432`. Si PostgreSQL se instaló en otra carpeta, cambia la ruta indicada en `-PostgresBin`.

## 6. Aplicar la estructura y datos de prueba

Cuando el paso anterior termine sin errores, ejecuta:

```powershell
npm --prefix apps\backend run prisma:migrate:deploy
npm --prefix apps\backend run db:seed
```

El primer comando crea las tablas. El segundo crea la institución y las cuentas de demostración.

Puedes comprobar la conexión con:

```powershell
npm --prefix apps\backend run db:check
```

Debe mostrar `PostgreSQL connection check passed.`

## 7. Encender el sistema

Abre **dos ventanas de PowerShell** dentro de la carpeta `2026-PROTEC-EDU`.

En la primera ventana, inicia el backend:

```powershell
npm --prefix apps\backend run start:dev
```

Espera el mensaje de NestJS indicando que está escuchando en el puerto `3000`. Deja esa ventana abierta.

En la segunda ventana, inicia el frontend:

```powershell
npm --prefix apps\frontend run start
```

Abre el navegador en:

```text
http://localhost:4200
```

## 8. Iniciar sesión con una cuenta de prueba

En la pantalla de ingreso usa:

| Campo | Valor |
| --- | --- |
| Código de institución | `DEMO-EDU` |
| Contraseña | `ProtecEdu!2026` |

Elige uno de estos códigos institucionales según el rol que quieras probar:

| Rol | Código institucional |
| --- | --- |
| Superadministrador | `D026100001` |
| Administrador | `D026100002` |
| Colaborador | `D026100003` |
| Docente | `D026100004` |
| Estudiante | `D026100005` |

El superadministrador y administrador pueden acceder al módulo de administración. Docentes y estudiantes no deben poder entrar a acciones administrativas.

## 9. Pruebas rápidas antes de entregar cambios

Con backend y frontend cerrados o abiertos, desde la carpeta principal puedes comprobar lo esencial:

```powershell
npm --prefix apps\backend run test
npm --prefix apps\backend run test:integration
npm --prefix apps\backend run test:rbac
npm --prefix apps\frontend run test -- --watch=false
npm --prefix apps\frontend run build
```

Las pruebas RBAC confirman que cada rol recibe únicamente los permisos que le corresponden.

## 10. Problemas frecuentes

### “El argumento .\apps\setup-protecedu-postgres.ps1 no se reconoce”

Estás en una carpeta equivocada. Ejecuta:

```powershell
cd C:\Users\Administrator\Documents\2026-PROTEC-EDU
Test-Path .\apps\setup-protecedu-postgres.ps1
```

Solo vuelve a ejecutar el asistente cuando el resultado sea `True`.

### “PostgreSQL no está aceptando conexiones”

Abre el administrador de servicios de Windows y verifica que el servicio de PostgreSQL esté iniciado. Revisa también que el puerto usado en el comando coincida con el de tu instalación.

### “No se pudo conectar a la base de datos”

Comprueba que exista `backend-erp-proteclinesac/.env`, que PostgreSQL esté encendido y que la contraseña de `protecedu_app` sea correcta. Puedes volver a ejecutar el asistente del paso 5 para regenerar la configuración local.

### El navegador muestra que no puede conectar

Confirma que ambas ventanas siguen abiertas: backend en puerto `3000` y frontend en puerto `4200`.

### Quiero detener el sistema

En cada ventana que está ejecutando un servidor, presiona `Ctrl + C`.

## 11. Cómo enviar cambios al equipo

Antes de subir cambios:

```powershell
git status
git add .
git commit -m "describe brevemente tu cambio"
git push
```

Nunca subas `backend-erp-proteclinesac/.env`, `node_modules`, `dist` ni contraseñas. El archivo `.gitignore` ya los excluye.

Para obtener cambios de tus compañeros:

```powershell
git pull
npm --prefix apps\backend run prisma:migrate:deploy
```

El último comando aplica las nuevas migraciones de base de datos, si las hubiera.
