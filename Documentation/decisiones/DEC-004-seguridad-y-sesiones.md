# DEC-004 — Seguridad y sesiones

**Estado:** ACEPTADA
**Versión:** 1.0
**Fecha:** 2026-09-11

## Decisión

Definir las reglas iniciales de acceso, contraseñas, bloqueo, recuperación y sesiones de ProtecEdu.

## Reglas aprobadas

1. Los estudiantes acceden inicialmente mediante código de alumno y contraseña.
2. La contraseña temporal inicial será el DNI y se utilizará únicamente como contraseña temporal.
3. Las contraseñas nunca se almacenan en texto plano; deben almacenarse mediante un hash seguro.
4. El sistema exigirá el cambio de la contraseña temporal en el primer acceso.
5. Toda contraseña nueva debe tener como mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.
6. Después de 5 intentos fallidos consecutivos, la cuenta queda bloqueada automáticamente y el evento queda registrado en auditoría.
7. Un administrador autorizado puede desbloquear cuentas según su alcance institucional.
8. La sesión tiene una duración máxima absoluta de 8 horas y finaliza por inactividad después de 30 minutos.
9. La recuperación de contraseña se realiza mediante un enlace temporal de un solo uso enviado al correo registrado, con vigencia de 30 minutos.
10. Si la cuenta no dispone de correo registrado, un administrador autorizado puede establecer una contraseña temporal.
11. Toda contraseña establecida administrativamente obliga al cambio de contraseña en el siguiente acceso.
12. El cierre de sesión debe invalidar efectivamente la sesión para que no pueda reutilizarse.

## Estado

Las reglas de seguridad y sesiones quedan aprobadas para el primer entregable y deben aplicarse en la especificación de autenticación y sus pruebas.
