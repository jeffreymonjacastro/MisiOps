FROM python:3.13-slim

# Install uv (pinned by version and digest: supply-chain finding T4)
COPY --from=ghcr.io/astral-sh/uv:0.12.14@sha256:1946145b8706ad9e5c0e79a513f9e324b58d5e38126bb2c8b7dbfca61febeb45 /uv /uvx /bin/

# Patch OS packages: fixable HIGH CVEs in zlib1g of python:3.13-slim blocked the container gate (2026-11-09).
RUN apt-get update && apt-get -y --no-install-recommends upgrade && rm -rf /var/lib/apt/lists/*

# Create a non-root user. pip is unused (uv manages the venv) and ships vulnerable vendored packages.
RUN groupadd -r appuser && useradd -r -g appuser appuser     && python -m pip uninstall -y pip

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
