"""Probe the real PostgreSQL upgrade in an isolated, rolled-back schema."""

import asyncio
from uuid import uuid4

import models.category  # noqa: F401
import models.prediction  # noqa: F401
import models.transaction  # noqa: F401
import models.user  # noqa: F401
from core.database import engine
from core.schema import configure_monitor_access, initialize_schema


async def main():
    schema = f"forecast_migration_{uuid4().hex}"
    try:
        async with engine.connect() as connection:
            transaction = await connection.begin()
            try:
                await connection.exec_driver_sql(f"CREATE SCHEMA {schema}")
                await connection.exec_driver_sql(f"SET LOCAL search_path = {schema}")
                await connection.exec_driver_sql(
                    """CREATE TABLE transactions (
                         id integer PRIMARY KEY, user_id integer, type varchar(16),
                         amount numeric(14, 2), transaction_date timestamptz
                       )"""
                )
                await connection.exec_driver_sql("INSERT INTO transactions (id) VALUES (1)")
                await initialize_schema(connection)
                await initialize_schema(connection)
                await connection.exec_driver_sql("INSERT INTO transactions (id) VALUES (2)")
                result = await connection.exec_driver_sql(
                    "SELECT created_at IS NULL FROM transactions ORDER BY id"
                )
                assert result.scalars().all() == [True, False]
                print("PostgreSQL upgrade preserves unknown timestamps and applies the new default")
                await configure_monitor_access(connection, uuid4().hex)
                permissions = await connection.exec_driver_sql(
                    """SELECT
                      has_column_privilege('misiops_forecast_monitor', 'transactions',
                                           'created_at', 'SELECT'),
                      has_table_privilege('misiops_forecast_monitor', 'transactions', 'UPDATE'),
                      has_column_privilege('misiops_forecast_monitor', 'prediction_observations',
                                           'actual_cents', 'UPDATE'),
                      has_column_privilege('misiops_forecast_monitor', 'prediction_observations',
                                           'forecast_cents', 'UPDATE')
                    """
                )
                assert tuple(permissions.one()) == (True, False, True, False)
                print("PostgreSQL monitor can read transaction timestamps and update labels only")
            finally:
                await transaction.rollback()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
