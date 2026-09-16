from core.database import SessionLocal


def test_production_session_does_not_expire_on_commit():
    # Regression guard: an async session that expires attributes on commit raises
    # MissingGreenlet on the first attribute access after commit (seen on POST /category/).
    assert SessionLocal.kw["expire_on_commit"] is False
