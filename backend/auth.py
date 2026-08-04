"""Clerk session authentication for FastAPI."""

from __future__ import annotations

import os

from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from fastapi import HTTPException, Request


load_dotenv(".env.local")

AUTHORIZED_PARTIES = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://alignposture.online",
    "https://www.alignposture.online",
]


def require_user(request: Request) -> str:
    secret_key = os.getenv("CLERK_SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=503, detail="Clerk is not configured.")
    state = Clerk(bearer_auth=secret_key).authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=secret_key,
            authorized_parties=AUTHORIZED_PARTIES,
            accepts_token=["session_token"],
        ),
    )
    user_id = state.payload.get("sub") if state.payload else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return str(user_id)


def optional_user(request: Request) -> str | None:
    authorization = request.headers.get("authorization")
    if not authorization:
        return None
    try:
        return require_user(request)
    except HTTPException as exc:
        if exc.status_code in {401, 503}:
            return None
        raise
