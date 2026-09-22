# Estructura futura de aplicaciones

Esta estructura es una referencia arquitectónica inicial para la siguiente etapa y podrá evolucionar mediante decisiones posteriores.

## Backend

```text
apps/backend/src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── roles/
│   ├── permissions/
│   ├── institutions/
│   └── audit/
├── shared/
└── config/
```

## Frontend

```text
apps/frontend/src/app/
├── core/
├── shared/
└── features/
    ├── auth/
    ├── users/
    └── roles/
```

Esta documentación no crea módulos, componentes ni código de aplicación.
