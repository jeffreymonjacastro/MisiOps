# Specification: Docker Compose Integration

## 1. Feature Description

Implement Docker containerization for the MisiOps project to enable a localized development environment. This requires creating Dockerfiles for both the Next.js frontend and the FastAPI backend, and orchestrating them alongside a PostgreSQL database using Docker Compose in a new `docker/` directory. The setup must follow specific networking and security rules to ensure isolation and secure credential management.

## 2. Problem Statement

Developers need a consistent and reproducible local environment to run the MisiOps application (frontend, backend, database) without manually configuring dependencies and services on their host machines. Sensitive credentials, such as the database password, must be securely managed and not exposed in version control or plain environment variables where possible.

## 3. User Scenarios & Testing

### 3.1 Scenario: Developer starts the environment
- Developer runs `docker compose up -d` in the `docker/` directory.
- Docker builds the frontend and backend images.
- Docker starts the PostgreSQL, backend, and frontend containers.
- Developer can access the Next.js frontend on their browser and it successfully connects to the backend API, which in turn connects to the PostgreSQL database.

### 3.2 Scenario: Data Persistence
- Developer creates data (e.g., a transaction) via the frontend.
- Developer stops the environment using `docker compose down`.
- Developer restarts the environment.
- The previously created data is still available, demonstrating volume persistence.

## 4. Functional Requirements

1. **Frontend Containerization**: A `Dockerfile` in `frontend/` must be created to build and run the Next.js application.
2. **Backend Containerization**: A `Dockerfile` in `backend/` must be created to build and run the FastAPI application using `uv`.
3. **Orchestration**: A `docker-compose.yaml` file in a new `docker/` directory must define the `frontend`, `backend`, and `postgres` services.
4. **Networking Isolation**:
   - `public` network (bridge): Exposes the `frontend` and `backend` (if needed for direct API access) to the host machine.
   - `private` network (internal): Connects `frontend`, `backend`, and `postgres`. The `postgres` service must only reside on the `private` network.
5. **Secure Credentials**:
   - PostgreSQL must initialize its password using a Docker secret file (`POSTGRES_PASSWORD_FILE`).
   - The backend must authenticate against the database using environment variables injected via an `env_file`.
6. **Data Persistence**: The PostgreSQL database must use a named volume to persist data across container restarts.

## 5. Success Criteria

- Running `docker compose up --build -d` successfully starts all three services.
- The `postgres` container is completely inaccessible from the host machine (no port mappings).
- Database credentials are not hardcoded in the `docker-compose.yaml` file.
- The backend successfully connects to the database.

## 6. Assumptions & Out of Scope

- **Assumptions**: The frontend and backend applications are currently capable of being run locally and don't have undiscovered dependencies that prevent containerization.
- **Out of Scope**: Production deployment configurations, CI/CD pipeline integration for Docker images, and orchestration beyond Docker Compose (e.g., Kubernetes).
