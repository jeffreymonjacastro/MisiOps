# MisiOps

## Descripción

¿Quién no ha tenido problemas gestionando sus finanzas personales? ¡Pues este dolor de cabeza se acabó! Con MisiOps podrás tener un control total de tus gastos, ingresos y presupuestos de manera sencilla y eficiente.

## Get Started

### Prerrequisitos

Para ejecutar este proyecto de forma local o mediante contenedores, necesitarás tener instalado lo siguiente en tu sistema:

- **Docker** y **Docker Compose** (Para levantar contenedores).
- **Python 3.13** y **uv** (Gestor de paquetes) para el Backend.
- **Node.js** y **pnpm** (Gestor de paquetes) para el Frontend.
- **PostgreSQL** (Si decides correr la base de datos de manera nativa local y no mediante Docker).

### Automatizaciones

Para facilitar el ciclo de desarrollo, el proyecto incluye varios scripts bash.

**Script Principal (Raíz):**
- **`run_project.sh`**: Es un atajo ubicado en la raíz que ejecuta internamente la automatización para levantar los contenedores del proyecto de forma rápida y sencilla.

**Scripts de la carpeta `automations/`:**
- **`run_local.sh`**: Levanta simultáneamente los servidores de desarrollo: el backend (FastAPI, puerto 8000) y el frontend (Next.js, puerto 3000). *(Requiere que la base de datos PostgreSQL ya esté corriendo)*.
- **`run_docker.sh`**: Levanta toda la infraestructura del proyecto usando Docker Compose en segundo plano.
- **`stop_docker.sh`**: Detiene los contenedores del proyecto.
- **`run_tests.sh`**: Ejecuta las pruebas automatizadas de ambos lados (Frontend usando `pnpm run test` y Backend usando `uv run pytest`) de una sola pasada.
- **`clone_and_setup.sh`**: Script para inicializar y configurar el proyecto recién clonado.

### Ejecutar las Pruebas

Para ejecutar las pruebas del **backend**, abre una terminal en la raíz del proyecto y corre el siguiente comando exacto:

```bash
cd backend && uv run pytest
```
*(Nota: Las pruebas del backend utilizan una base de datos SQLite en memoria, por lo que no es necesario tener levantado PostgreSQL).*

Para ejecutar las pruebas del **frontend**, utiliza el siguiente comando:

```bash
cd frontend && pnpm run test
```

*(Opcionalmente, puedes ejecutar ambas suites de pruebas al mismo tiempo utilizando el script de automatización: `bash automations/run_tests.sh`)*
