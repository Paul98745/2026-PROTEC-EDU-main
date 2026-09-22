# ESP-001 — Autenticación

**Estado:** APROBADA
**Versión:** 1.0
**Fecha de creación:** 2026-09-11
**Requerimientos relacionados:** REQ-001 / RF-01, RF-02, RF-04, RF-08 y RF-09.

## 1. Objetivo

Permitir que un usuario autorizado se identifique en ProtecEdu, acceda a una sesión válida y la cierre de forma segura. El módulo debe impedir el acceso de cuentas inactivas o bloqueadas y dejar evidencia de los eventos relevantes.

## 2. Alcance

Esta especificación incluye:

- inicio de sesión mediante el identificador de acceso aprobado;
- cierre de sesión;
- control de estados de cuenta durante el acceso;
- recuperación y restablecimiento de contraseña;
- registro de accesos, cierres e intentos fallidos;
- disponibilidad de la identidad, institución y permisos efectivos del usuario autenticado para los módulos posteriores;
- implementación del backend mediante NestJS.

## 3. Fuera de alcance

- Inicio de sesión único con plataformas externas.
- Autenticación mediante redes sociales o cuentas de terceros.
- Matrícula, cursos, pagos u otros módulos de negocio.
- Definición visual final de los paneles posteriores al inicio de sesión.

## 4. Reglas de negocio

1. Los estudiantes inician sesión con su código de alumno y contraseña.
2. La contraseña temporal inicial es el DNI y debe cambiarse obligatoriamente en el primer acceso.
3. Solo las cuentas con estado `ACTIVA` pueden iniciar sesión.
4. Las cuentas `INACTIVA` y `BLOQUEADA` deben rechazar el inicio de sesión.
5. La nueva contraseña debe tener un mínimo de 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.
6. Las contraseñas nunca se almacenan en texto plano.
7. El mensaje de rechazo no debe revelar si la credencial, la contraseña o el estado de la cuenta fue el motivo específico del fallo.
8. Después de 5 intentos fallidos consecutivos, la cuenta queda bloqueada y el evento queda registrado en auditoría.
9. Un administrador autorizado puede desbloquear cuentas según su alcance institucional.
10. El cierre de sesión debe invalidar la sesión para que no pueda reutilizarse.
11. La sesión tiene una duración máxima absoluta de 8 horas y finaliza por inactividad después de 30 minutos.
12. La recuperación de contraseña utiliza un enlace temporal de un solo uso enviado al correo registrado y vence después de 30 minutos.
13. Si no existe correo registrado, un administrador autorizado puede establecer una contraseña temporal, que debe cambiarse en el siguiente acceso.
14. El sistema debe registrar el resultado de cada intento de inicio de sesión y el cierre de sesión.
15. Tras autenticarse, el sistema debe disponer de la institución, los roles y los permisos efectivos acumulativos del usuario para controlar los módulos protegidos.

Las reglas de seguridad y sesiones se definen en [DEC-004](../decisiones/DEC-004-seguridad-y-sesiones.md).

## 5. Flujo principal: inicio de sesión

1. El usuario ingresa su identificador de acceso y contraseña.
2. El sistema valida las credenciales y el estado de la cuenta.
3. Si la cuenta está activa y las credenciales son correctas, el sistema crea una sesión y registra el acceso exitoso.
4. Si la contraseña es temporal, el sistema exige su cambio antes de continuar.
5. El sistema dirige al usuario a la vista inicial autorizada para su perfil.
6. Si la validación falla, el sistema registra el intento fallido y muestra un mensaje genérico.

## 6. Flujo principal: recuperación de contraseña

1. El usuario solicita recuperar su contraseña indicando el identificador permitido.
2. El sistema registra la solicitud sin revelar si la cuenta existe.
3. Si corresponde, el sistema envía al correo registrado un enlace temporal de un solo uso con vigencia de 30 minutos.
4. El usuario define una contraseña nueva que cumpla la política aprobada.
5. El enlace temporal queda inutilizable y el evento se registra en auditoría.
6. Si no hay correo registrado, un administrador autorizado puede establecer una contraseña temporal que se debe cambiar en el siguiente acceso.

## 7. Criterios de aceptación

| ID | Criterio |
| --- | --- |
| CA-01 | Una cuenta activa con credenciales correctas puede iniciar sesión. |
| CA-02 | Una cuenta inactiva o bloqueada no obtiene sesión, aun cuando sus credenciales sean correctas. |
| CA-03 | Después de 5 intentos fallidos consecutivos, la cuenta queda bloqueada y el evento queda registrado. |
| CA-04 | Una contraseña temporal inicial o administrativa obliga al cambio de contraseña en el siguiente acceso. |
| CA-05 | La nueva contraseña cumple la política aprobada. |
| CA-06 | Después de cerrar sesión, la sesión anterior no permite acceder a una ruta protegida. |
| CA-07 | La sesión finaliza al cumplir 8 horas o 30 minutos de inactividad. |
| CA-08 | La recuperación de contraseña no revela si el identificador solicitado existe. |
| CA-09 | Un enlace de recuperación usado o vencido no permite cambiar la contraseña. |
| CA-10 | Un administrador autorizado puede desbloquear cuentas y establecer una contraseña temporal según su alcance institucional. |
| CA-11 | El inicio, cierre, recuperación e intento fallido quedan disponibles en la auditoría básica. |
| CA-12 | Al iniciar sesión, las rutas y acciones posteriores son controladas por la institución, roles y permisos efectivos acumulativos del usuario. |
