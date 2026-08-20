import os
import uuid

from fastapi import APIRouter, Depends, Request, UploadFile
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.models import MediaAsset
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates

UPLOAD_DIR = "data/uploads"
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def save_upload_to_library(file_bytes: bytes, original_filename: str, uploaded_by: int, db: Session) -> MediaAsset:
    """Enregistre un fichier uploadé sur disque + dans la bibliothèque de médias.
    Utilisé partout où un média est envoyé (composer, publicités...) pour que la
    bibliothèque se remplisse naturellement, sans étape supplémentaire."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(original_filename)[1].lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(file_bytes)
    media_type = "video" if ext in VIDEO_EXT else "image" if ext in IMAGE_EXT else None

    asset = MediaAsset(path=path, media_type=media_type, original_filename=original_filename, uploaded_by=uploaded_by)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/media")
def media_page(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    assets = db.query(MediaAsset).order_by(MediaAsset.created_at.desc()).all()
    return templates.TemplateResponse(
        "media.html",
        {
            "request": request,
            "active": "media",
            "assets": assets,
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/media/upload")
async def media_upload(request: Request, db: Session = Depends(get_db), user=Depends(require_user)):
    form = await request.form()
    files = form.getlist("files")
    added = 0
    for file in files:
        if hasattr(file, "filename") and file.filename:
            content = await file.read()
            save_upload_to_library(content, file.filename, user.id, db)
            added += 1
    if added == 0:
        return RedirectResponse("/media?error=Aucun+fichier+valide.", status_code=303)
    return RedirectResponse(f"/media?success={added}+média(s)+ajouté(s).", status_code=303)


@router.post("/media/{asset_id}/delete")
def media_delete(asset_id: int, db: Session = Depends(get_db), user=Depends(require_user)):
    asset = db.get(MediaAsset, asset_id)
    if asset:
        try:
            os.remove(asset.path)
        except OSError:
            pass
        db.delete(asset)
        db.commit()
    return RedirectResponse("/media?success=Média+supprimé.", status_code=303)
