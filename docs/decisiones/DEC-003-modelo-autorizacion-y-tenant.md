# DEC-003 — Modelo de autorización e institución

**Estado:** ACEPTADA
**Versión:** 1.0
**Fecha:** 2026-09-11

## Decisión

Usar RBAC con permisos por módulo y acción, junto con un modelo multiinstitución basado en una institución asociada a cada entidad institucional.

## Reglas aprobadas

1. Un rol agrupa permisos.
2. Un permiso representa una acción sobre un módulo.
3. Un usuario puede tener uno o más roles dentro de la misma institución.
4. Los permisos efectivos de un usuario son la unión de los permisos de sus roles.
5. Todas las consultas institucionales se filtran en la API utilizando el contexto de la sesión.
6. El Superadministrador puede tener alcance global para permisos expresamente definidos.

## Motivo

El modelo permite que los roles principales se mantengan claros y que los Colaboradores cuenten con perfiles granulares, sin crear un nuevo rol para cada área.

## Consecuencias

- El esquema de datos deberá relacionar usuarios, roles, permisos e instituciones.
- La seguridad no podrá depender únicamente de las pantallas de Angular.
- Las futuras entidades académicas y administrativas deberán incluir su relación institucional.

## Estado

El modelo RBAC, el aislamiento institucional y la combinación de varios roles por usuario quedan aprobados para el primer entregable.
