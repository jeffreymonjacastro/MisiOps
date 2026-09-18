# Implementation Tasks: Docker Compose Integration

- [ ] 1. **Update .gitignore**: Append `docker/.env.dev` and `docker/pg_password.txt` to the root `.gitignore` file.
- [ ] 2. **Create backend Dockerfile**: Add `Dockerfile` and `.dockerignore` to `backend/` for the FastAPI service using `uv`.
- [ ] 3. **Create frontend Dockerfile**: Add `Dockerfile` and `.dockerignore` to `frontend/` for the Next.js service.
- [ ] 4. **Create secrets**: Create `docker/.env.dev` and `docker/pg_password.txt` with dummy secure passwords for development.
- [x] 5. **Create docker-compose.yaml**: In `docker/docker-compose.yaml`, define `frontend`, `backend`, and `postgres` services following the networking and secrets plan.
- [x] 6. **Verification**: Confirm `docker compose up --build -d` runs successfully from the `docker/` folder.
- [x] 7. **Fix Project Name**: Add `name: misiops` to `docker-compose.yaml`.
- [x] 8. **Fix Backend Command**: Use `uvicorn main:app` instead of `fastapi run` in backend `Dockerfile`.
- [x] 9. **Fix DB Env Vars**: Update compose and `.env.dev` to use `POSTGRES_SERVER`, `POSTGRES_DB`, etc. instead of `DB_*` to match MisiOps config.
- [ ] 10. **Add CI Workflow**: Create `.github/workflows/docker-integration.yml` to automatically test `docker compose up` on PRs.
