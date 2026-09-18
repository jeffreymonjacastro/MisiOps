# Implementation Tasks: Docker Compose Integration

- [ ] 1. **Update .gitignore**: Append `docker/.env.dev` and `docker/pg_password.txt` to the root `.gitignore` file.
- [ ] 2. **Create backend Dockerfile**: Add `Dockerfile` and `.dockerignore` to `backend/` for the FastAPI service using `uv`.
- [ ] 3. **Create frontend Dockerfile**: Add `Dockerfile` and `.dockerignore` to `frontend/` for the Next.js service.
- [ ] 4. **Create secrets**: Create `docker/.env.dev` and `docker/pg_password.txt` with dummy secure passwords for development.
- [ ] 5. **Create docker-compose.yaml**: In `docker/docker-compose.yaml`, define `frontend`, `backend`, and `postgres` services following the networking and secrets plan.
- [ ] 6. **Verification**: Confirm `docker compose up --build -d` runs successfully from the `docker/` folder.
