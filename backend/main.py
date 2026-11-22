import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

import models.category  # noqa: F401
import models.transaction  # noqa: F401
import models.user  # noqa: F401  (register models before create_all)
from api.v1.router import api_router
from core.config import settings
from core.database import engine
from core.forecast_model import load_release
from core.schema import configure_monitor_access, initialize_schema

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.forecast_model = None
    app.state.forecast_release_required = bool(settings.FORECAST_RELEASE_DIR)
    if settings.FORECAST_RELEASE_DIR:
        try:
            app.state.forecast_model = load_release(Path(settings.FORECAST_RELEASE_DIR))
        except Exception:
            logging.getLogger(__name__).exception("Forecast release failed startup validation")
    async with engine.begin() as conn:
        await initialize_schema(conn)
        if settings.FORECAST_MONITOR_PASSWORD:
            await configure_monitor_access(
                conn, settings.FORECAST_MONITOR_PASSWORD.get_secret_value()
            )
    yield
    await engine.dispose()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)

# Hardening headers flagged by the ZAP API scan (specs/011-devsecops). Added after CORS so it is the
# outermost middleware and also covers preflight and error responses.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    return response


@app.get("/")
async def health(response: Response):
    if getattr(app.state, "forecast_release_required", False) and app.state.forecast_model is None:
        response.status_code = 503
        return {"status": "forecast_unavailable"}
    return {"status": "ok"}
