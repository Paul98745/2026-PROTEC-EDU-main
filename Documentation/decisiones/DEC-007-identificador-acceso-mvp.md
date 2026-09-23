# DEC-007 — Identificador de acceso para el MVP

**Estado:** ACEPTADA
**Versión:** 2.0
**Fecha:** 2026-09-11

## Decisión

El inicio de sesión del MVP requiere el código de institución y el código institucional del usuario, además de la contraseña.

## Motivo

`studentCode` representa el `codigo_institucional`, es único dentro de una institución, inmutable y sigue el patrón `[I][YYY][P][SSSSS]`: un prefijo institucional, los últimos tres dígitos del año, período académico de 1 a 9 y una secuencia de cinco o más dígitos. Solicitar ambos valores evita ambigüedad cuando una persona pertenece a más de una institución y preserva el modelo multiinstitucional aprobado.

## Alcance

- El MVP habilita acceso mediante `institutionCode + studentCode + password`.
- La secuencia se reserva atómicamente por institución/año/período. El paso de `99999` a `100000` amplía el código sin truncarlo.
- El superadministrador es una capacidad global explícita de la identidad; conserva una institución activa por sesión para crear usuarios y roles, pero puede consultar usuarios y auditoría entre instituciones.
- La institución activa de la sesión se determina al iniciar sesión y limita los roles y permisos devueltos por la API.
