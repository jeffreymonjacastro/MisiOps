FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Create a non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy dependency files and install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy only the necessary application source code directories
COPY api api/
COPY core core/
COPY models models/
COPY schemas schemas/
COPY main.py .

# Install the project itself (without dev dependencies)
RUN uv sync --frozen --no-dev

# Set permissions for the non-root user
RUN chown -R appuser:appuser /app
USER appuser

# Put the virtual environment in the PATH
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Start FastAPI application using the production CLI
CMD ["fastapi", "run", "main.py", "--host", "0.0.0.0", "--port", "8000"]
