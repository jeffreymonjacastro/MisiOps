from sqlalchemy import text

from core.database import Base


async def initialize_schema(connection):
    if connection.dialect.name == "postgresql":
        # Serialize initialization across concurrently starting containers.
        await connection.execute(text("SELECT pg_advisory_xact_lock(1241055283)"))
    await connection.run_sync(Base.metadata.create_all)
    if connection.dialect.name == "postgresql":
        await connection.execute(
            text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at timestamptz")
        )
        await connection.execute(
            text("ALTER TABLE transactions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP")
        )


async def configure_monitor_access(connection, password: str) -> None:
    if connection.dialect.name != "postgresql":
        return
    await connection.execute(
        text("SELECT set_config('misiops.monitor_password', :password, true)"),
        {"password": password},
    )
    await connection.execute(
        text("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'misiops_forecast_monitor') THEN
            CREATE ROLE misiops_forecast_monitor LOGIN;
          END IF;
          EXECUTE format('ALTER ROLE misiops_forecast_monitor PASSWORD %L',
                         current_setting('misiops.monitor_password'));
        END
        $$;
    """)
    )
    await connection.execute(
        text(
            "GRANT SELECT (user_id, type, amount, transaction_date, created_at) "
            "ON transactions TO misiops_forecast_monitor"
        )
    )
    await connection.execute(
        text(
            "GRANT SELECT, UPDATE (actual_cents, evaluated_at) "
            "ON prediction_observations TO misiops_forecast_monitor"
        )
    )
