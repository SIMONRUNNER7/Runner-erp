import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth import require_user
from app.db import get_db
from app.integrations.registry import PLATFORM_COLORS, PLATFORM_LABELS
from app.models import Conversation, MESSAGING_CAPABLE_PLATFORMS, Message, MessageDirection, SocialAccount
from app.services import unread_messages_count, unread_notifications_count

router = APIRouter()
from app.templating import templates

DEMO_CONTACTS = [
    ("Léa Martin", "Bonjour ! Vous avez encore des créneaux disponibles ce week-end ?"),
    ("Thomas Roy", "Super la vidéo du dernier parcours 👏 vous proposez des cours pour débutants ?"),
    ("Sophie Bernard", "Merci pour la réponse rapide, à bientôt sur le green !"),
    ("Marc Dubois", "Est-ce que le pro-shop est ouvert le lundi ?"),
    ("Julie Petit", "Je voudrais réserver pour un groupe de 4 personnes."),
]

CANNED_AUTO_REPLY = "Merci pour votre message, notre équipe vous répond au plus vite ! ⛳"


def _seed_demo_conversations(db: Session):
    if db.query(Conversation).count() > 0:
        return
    accounts = db.query(SocialAccount).all()
    if not accounts:
        return
    random.seed(42)
    for i, account in enumerate(accounts):
        name, first_msg = DEMO_CONTACTS[i % len(DEMO_CONTACTS)]
        convo = Conversation(
            platform=account.platform,
            account_id=account.id,
            external_id=f"demo-conv-{account.id}",
            participant_name=name,
            last_message_at=datetime.utcnow() - timedelta(minutes=random.randint(5, 600)),
            unread=True,
            simulated=True,
        )
        db.add(convo)
        db.flush()
        db.add(Message(conversation_id=convo.id, direction=MessageDirection.inbound, text=first_msg, sent_at=convo.last_message_at))
    db.commit()


@router.get("/inbox")
def inbox_page(request: Request, conversation_id: int = None, db: Session = Depends(get_db), user=Depends(require_user)):
    _seed_demo_conversations(db)
    conversations = db.query(Conversation).order_by(Conversation.last_message_at.desc()).all()

    active = None
    if conversation_id:
        active = db.get(Conversation, conversation_id)
    elif conversations:
        active = conversations[0]

    if active and active.unread:
        active.unread = False
        db.commit()

    return templates.TemplateResponse(
        "inbox.html",
        {
            "request": request,
            "active": "inbox",
            "conversations": conversations,
            "active_conversation": active,
            "platform_labels": PLATFORM_LABELS,
            "platform_colors": PLATFORM_COLORS,
            "messaging_capable": [p.value for p in MESSAGING_CAPABLE_PLATFORMS],
            "unread_count": unread_notifications_count(db),
            "unread_messages_count": unread_messages_count(db),
        },
    )


@router.post("/inbox/{conversation_id}/reply")
def reply(conversation_id: int, text: str = Form(...), db: Session = Depends(get_db), user=Depends(require_user)):
    convo = db.get(Conversation, conversation_id)
    if not convo or not text.strip():
        return RedirectResponse(f"/inbox?conversation_id={conversation_id}", status_code=303)

    now = datetime.utcnow()
    db.add(Message(conversation_id=convo.id, direction=MessageDirection.outbound, text=text.strip(), sent_at=now))
    convo.last_message_at = now

    if convo.simulated:
        auto_reply_at = now + timedelta(seconds=1)
        db.add(Message(conversation_id=convo.id, direction=MessageDirection.inbound, text=CANNED_AUTO_REPLY, sent_at=auto_reply_at))
        convo.last_message_at = auto_reply_at
        convo.unread = False

    db.commit()
    return RedirectResponse(f"/inbox?conversation_id={conversation_id}", status_code=303)
