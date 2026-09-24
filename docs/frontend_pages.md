# Páginas del Frontend (Next.js)

Estructura principal de las páginas e interfaces de usuario del frontend de MisiOps.

## Mapa de Rutas

```mermaid
flowchart TD
    App[Aplicación Frontend]
    
    App --> Home[🏠 Home / Dashboard]
    App --> Login[🔑 Login / Registro]
    App --> Categorias[📁 Categorías]
    App --> Movimientos[💸 Movimientos / Transacciones]
    
    Home -.-> |"Muestra un resumen \n global"| Resumen[Resumen Financiero]
    Login -.-> |"Ruta: /login"| AuthLayout[Layout de Autenticación]
    Categorias -.-> |"Ruta: /categorias"| GestorCat[Gestor de Categorías]
    Movimientos -.-> |"Ruta: /movimientos"| GestorMov[Historial y Gestor de Movimientos]
```

## Directorio de Rutas
- `/`: **Dashboard Principal**. Muestra el resumen del estado financiero y balance.
- `/login`: **Página de Autenticación**. Donde los usuarios inician sesión y se registran.
- `/categorias`: **Administración de Categorías**. Interfaz para crear, editar y eliminar categorías de ingresos y gastos.
- `/movimientos`: **Historial de Transacciones**. Tabla e interfaz para registrar, filtrar y gestionar los ingresos y gastos (transacciones).
