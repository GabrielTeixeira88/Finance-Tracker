import asyncio
import os
from typing import Literal
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict

from app import local_backups
from app.config import get_settings


def local_admin(request: Request):
    host = urlsplit("http://" + request.headers.get("host", "")).hostname
    origin = request.headers.get("origin")
    allowed = {str(request.base_url).rstrip("/"), "http://127.0.0.1:5173", "http://localhost:5173"}
    if (
        hasattr(request.app.state, "demo_store")
        or host not in {"127.0.0.1", "localhost", "::1"}
        or request.headers.get("x-finance-admin") != "1"
        or (origin and origin not in allowed)
    ):
        raise HTTPException(403, "Backups require the local personal application origin and header")


router = APIRouter(
    prefix="/api/settings/backups", tags=["local backups"], dependencies=[Depends(local_admin)]
)


@router.get("")
def list_backups():
    return {
        "maintenance": get_settings().maintenance_mode,
        "max_bytes": local_backups.MAX_BYTES,
        "items": sorted(
            [
                local_backups.metadata(p)
                for p in local_backups.folder().glob("*.db")
                if local_backups.BACKUP_ID.fullmatch(p.stem) and not p.is_symlink()
            ],
            key=lambda item: item["created_at"],
            reverse=True,
        ),
    }


@router.post("", status_code=201)
def create_backup():
    return local_backups.create()


@router.get("/{identifier}/download")
def download_backup(identifier: str):
    return FileResponse(
        local_backups.backup_path(identifier),
        media_type="application/octet-stream",
        filename="finance-tracker-backup.db",
        headers={"Cache-Control": "no-store"},
    )


class Confirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmation: Literal["RESTORE"]


@router.post("/{identifier}/restore")
def restore_backup(identifier: str, data: Confirmation):
    return local_backups.restore(identifier)


@router.post("/upload", status_code=201)
async def upload_backup(request: Request):
    if not get_settings().maintenance_mode:
        raise HTTPException(409, "Backup uploads require maintenance mode")
    path = local_backups.folder() / (uuid4().hex + ".upload")
    count = 0
    try:
        with path.open("xb") as target:
            os.chmod(path, 0o600)
            async for chunk in request.stream():
                count += len(chunk)
                if count > local_backups.MAX_BYTES:
                    raise HTTPException(413, "Backup exceeds the 128 MiB upload limit")
                target.write(chunk)
        await asyncio.to_thread(local_backups.validate, path, get_settings().resolved_database_path)
        final = path.with_suffix(".db")
        os.replace(path, final)
        return local_backups.metadata(final)
    finally:
        path.unlink(missing_ok=True)
