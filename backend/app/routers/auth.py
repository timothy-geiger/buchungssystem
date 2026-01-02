from fastapi import APIRouter, HTTPException
from app.schemas.auth import LoginRequest
from app.core.security import create_session
from app.core.config import USER_PASSWORD, ADMIN_PASSWORD
from app.enums import Role

router = APIRouter(prefix="/auth")


@router.post("/login")
def login(data: LoginRequest):
    if data.password == ADMIN_PASSWORD:
        return {"token": create_session(Role.ADMIN), "role": Role.ADMIN}

    if data.password == USER_PASSWORD:
        return {"token": create_session(Role.USER), "role": Role.USER}

    raise HTTPException(401, "Falsches Passwort")
