# DEC-002 — Arquitectura inicial

**Estado:** ACEPTADA
**Versión:** 1.0
**Fecha:** 2026-09-11

## Decisión

Implementar ProtecEdu como un monolito modular con tres componentes separados:

```text
Aplicación Angular → API Node.js (NestJS) → PostgreSQL
```

## Contexto

El primer entregable necesita autenticación, usuarios, roles, permisos, auditoría y aislamiento institucional. Son módulos estrechamente relacionados y conviene desarrollarlos y desplegarlos como una sola aplicación de backend modular durante la etapa inicial.

## Consecuencias

- Angular será responsable de la experiencia de usuario y de ocultar opciones no permitidas.
- La API será responsable de validar autenticación, permisos e institución en cada operación.
- PostgreSQL conservará las entidades, restricciones y auditoría.
- No se usarán microservicios en el primer entregable.
- NestJS es el framework aprobado para la API Node.js; la herramienta de acceso a datos se registrará en una decisión posterior.

## Estado

Esta arquitectura queda aprobada como base de la primera etapa. La aplicación se implementará como un sistema modular único, sin microservicios.
