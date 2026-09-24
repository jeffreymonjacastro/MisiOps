# Endpoints del Backend

A continuación se presenta un diagrama de flujo y una tabla resumiendo los endpoints disponibles en el Backend (API v1).

## Mapa de Endpoints

```mermaid
flowchart LR
    API[Base: /api/v1]
    
    API --> Auth[Auth]
    Auth --> Login[POST /auth/login]
    Auth --> Register[POST /auth/register]
    
    API --> Users[Users]
    Users --> GetMe[GET /user/me]
    Users --> UpdateMe[PATCH /user/]
    Users --> DeleteMe[DELETE /user/]
    
    API --> Categories[Categories]
    Categories --> GetCat[GET /category/]
    Categories --> CreateCat[POST /category/]
    Categories --> UpdCat[PATCH /category/{id}]
    Categories --> DelCat[DELETE /category/{id}]
    
    API --> Transactions[Transactions]
    Transactions --> GetTx[GET /transactions]
    Transactions --> PostTx[POST /transactions]
    Transactions --> SummaryTx[GET /transactions/summary]
    Transactions --> UpdTx[PATCH /transactions/{id}]
    Transactions --> DelTx[DELETE /transactions/{id}]
```

## Tabla de Endpoints

| Área | Método | Endpoint | Descripción |
|---|---|---|---|
| **Auth** | `POST` | `/auth/login` | Loguear un usuario y obtener token |
| **Auth** | `POST` | `/auth/register` | Registrar un nuevo usuario |
| **User** | `GET` | `/user/me` | Listar información del usuario actual |
| **User** | `PATCH` | `/user/` | Actualizar perfil de usuario |
| **User** | `DELETE` | `/user/` | Eliminar perfil de usuario |
| **Category** | `GET` | `/category/` | Listar todas las categorías del usuario |
| **Category** | `POST` | `/category/` | Crear una categoría personalizada |
| **Category** | `PATCH` | `/category/{id}` | Actualizar una categoría |
| **Category** | `DELETE` | `/category/{id}` | Eliminar una categoría |
| **Transaction** | `GET` | `/transactions` | Listar transacciones (con filtros por tipo o categoría y paginación) |
| **Transaction** | `POST` | `/transactions` | Crear una nueva transacción |
| **Transaction** | `GET` | `/transactions/summary`| Obtener resumen de presupuesto, ingresos, gastos y balance |
| **Transaction** | `PATCH` | `/transactions/{id}` | Actualizar una transacción |
| **Transaction** | `DELETE` | `/transactions/{id}` | Eliminar una transacción |
