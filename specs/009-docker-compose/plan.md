# Technical Plan: Docker Compose Integration

## 1. Architecture & Design

### 1.1 Overview
We will create a multi-container Docker application using Docker Compose. The environment will consist of three services:
- **frontend**: Next.js application running in development mode (or standalone if preferred, but for local dev, `npm run dev` or a production build could be used. To align with a deployable artifact, we'll write a multi-stage Dockerfile but optimize it for the local dev environment if needed, or provide a standard production-like build).
- **backend**: FastAPI application running with uvicorn via `uv`.
- **postgres**: PostgreSQL 16 database.

### 1.2 Networking Strategy
To ensure the isolation described in the user's guide:
- `public` network (bridge): Connected to `frontend` and `backend`.
- `private` network (internal: true): Connected to `frontend`, `backend`, and `postgres`.
The database will ONLY be on the `private` network, making it inaccessible from the host.

### 1.3 Secrets Management
- Create `docker/.env.dev` containing the `DB_PASSWORD` for the backend.
- Create `docker/pg_password.txt` containing the plain password for PostgreSQL.
- Add both files to `.gitignore`.
- Use `POSTGRES_PASSWORD_FILE` in the `postgres` service to read from the secret.
- Use `env_file` in the `backend` service to inject the password variable.

## 2. File Modifications

### 2.1 Backend Dockerfile (`backend/Dockerfile`)
Create a Dockerfile that:
- Uses a Python 3.12 image.
- Installs `uv`.
- Copies `pyproject.toml` and installs dependencies.
- Copies the application code.
- Exposes port 8000.
- Runs `uvicorn main:app --host 0.0.0.0 --port 8000`.

### 2.2 Frontend Dockerfile (`frontend/Dockerfile`)
Create a Dockerfile that:
- Uses a Node.js image (e.g., 20-alpine).
- Installs dependencies using `npm`.
- Copies the application code.
- Exposes port 3000.
- Runs `npm run dev` for local development.

### 2.3 Docker Compose configuration (`docker/docker-compose.yaml`)
Create the compose file defining:
- **Project name**: `misiops`
- `frontend` service (port 3000).
- `backend` service (port 8000).
- `postgres` service (no exposed ports, uses secrets, named volume).
- Networks: `public` and `private`.
- Secrets: `pg_password`.
- Volumes: `postgres-data`.

### 2.4 Ignore Files
- Update `.gitignore` in the root to exclude `.env.dev` and `pg_password.txt`.
- Add `.dockerignore` files in `frontend/` and `backend/` to prevent unnecessary files (like `node_modules/`, `__pycache__/`, `.env`) from being copied into the images.

### 2.5 GitHub Actions Workflow (`.github/workflows/docker-integration.yml`)
Create a new workflow that triggers on PRs to `develop`:
- Checks out the repository.
- Generates dummy secrets via `echo` commands into `docker/.env.dev` and `docker/pg_password.txt`.
- Runs `docker compose -p misiops up --build -d` inside the `docker/` directory.
- Waits for healthchecks to pass or sleeps for a short period.
- Executes `curl -f http://localhost:8000/` to ensure the API is reachable.
- Runs `docker compose logs` on failure for debugging.

## 3. Risks & Mitigations
- **Network Resolution**: Backend must connect to `postgres:5432`. Frontend must connect to `backend:8000`. Next.js Server Components can use `http://backend:8000`, while Client Components need to connect through a proxy or public URL. We will configure backend URLs accordingly.

## 4. Required Tools & Skills
- Docker & Docker Compose
- FastAPI/Python knowledge
- Next.js/Node knowledge
