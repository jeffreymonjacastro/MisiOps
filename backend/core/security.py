from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from core.config import settings

ALGORITHM = "HS256"
_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _hasher.verify(password, hashed)


# Verified against when the email is unknown, so both login failure paths cost the same.
DUMMY_HASH = hash_password("dummy")


def create_access_token(user_id: int) -> str:
    # settings is read on every call so tests can monkeypatch the lifetime
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire}, settings.SECRET_KEY, algorithm=ALGORITHM
    )


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.isdigit():
        return None
    return int(sub)
