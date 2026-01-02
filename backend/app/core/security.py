import hmac
import hashlib
from fastapi import HTTPException, Header
from app.enums import Role
from app.core.config import SESSION_SECRET


def create_session(role: Role) -> str:
    msg = role.value.encode()
    sig = hmac.new(
        SESSION_SECRET.encode(),
        msg,
        hashlib.sha256
    ).hexdigest()
    return f"{role.value}:{sig}"


def verify_session(authorization: str = Header(...)) -> Role:
    try:
        role_str, sig = authorization.split(":")
        role = Role(role_str)

        expected = hmac.new(
            SESSION_SECRET.encode(),
            role.value.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(sig, expected):
            raise ValueError

        return role

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Ungültige Sitzung. Bitte erneut anmelden."
        )
