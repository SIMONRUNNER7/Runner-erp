import enum
import json
import re
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db import Base


class Platform(str, enum.Enum):
    youtube = "youtube"
    tiktok = "tiktok"
    instagram = "instagram"
    facebook = "facebook"
    linkedin = "linkedin"


class PostStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    failed = "failed"


class TargetStatus(str, enum.Enum):
    pending = "pending"
    publishing = "publishing"
    published = "published"
    failed = "failed"


class NotificationType(str, enum.Enum):
    best_time = "best_time"
    suggestion = "suggestion"
    publish_success = "publish_success"
    publish_error = "publish_error"
    message = "message"


class PostType(str, enum.Enum):
    feed = "feed"
    story = "story"


class MessageDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    completed = "completed"


class CampaignObjective(str, enum.Enum):
    awareness = "awareness"
    traffic = "traffic"
    engagement = "engagement"
    leads = "leads"
    conversions = "conversions"


class UserRole(str, enum.Enum):
    admin = "admin"       # accès complet : comptes, activation des pubs, équipe
    editor = "editor"     # peut créer/planifier des posts, répondre aux messages ; pas de gestion compte/pub/équipe


class EditorialEventType(str, enum.Enum):
    tournage = "tournage"
    photo = "photo"
    presse = "presse"
    evenement = "evenement"

    # Plateformes qui exposent une véritable notion de "story" éphémère via leur API publique.
    # TikTok, LinkedIn et YouTube n'ont pas d'équivalent — l'option est masquée pour elles.


STORY_CAPABLE_PLATFORMS = {Platform.instagram, Platform.facebook}

# Plateformes pour lesquelles une messagerie privée via API publique existe (même si elle
# nécessite une configuration webhook supplémentaire). Les autres n'ont structurellement
# aucune API de messagerie business ouverte aux apps tierces.
MESSAGING_CAPABLE_PLATFORMS = {Platform.instagram, Platform.facebook}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.admin)
    created_at = Column(DateTime, default=datetime.utcnow)


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True)
    platform = Column(Enum(Platform), nullable=False)
    account_name = Column(String, nullable=False, default="")
    external_id = Column(String, nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    connected = Column(Boolean, default=False)
    simulated = Column(Boolean, default=True)  # True tant que les vraies clés API ne sont pas configurées
    created_at = Column(DateTime, default=datetime.utcnow)

    targets = relationship("PostTarget", back_populates="account")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    caption = Column(Text, nullable=False, default="")
    media_path = Column(String, nullable=True)
    media_type = Column(String, nullable=True)  # image | video
    status = Column(Enum(PostStatus), default=PostStatus.draft)
    post_type = Column(Enum(PostType), default=PostType.feed)
    scheduled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # JSON libre : hashtags, mentions, lieu, alt_text, first_comment, link_url, visibility...
    options_json = Column(Text, nullable=True)

    targets = relationship("PostTarget", back_populates="post", cascade="all, delete-orphan")

    @property
    def options(self) -> dict:
        if not self.options_json:
            return {}
        try:
            return json.loads(self.options_json)
        except ValueError:
            return {}

    @options.setter
    def options(self, value: dict):
        self.options_json = json.dumps(value or {})

    @property
    def effective_caption(self) -> str:
        """Texte réellement envoyé à la plateforme : légende + hashtags/mentions du
        champ dédié, ajoutés au format standard (#tag, @mention), sans doublon avec
        ce qui est déjà écrit à la main dans la légende."""
        caption = self.caption or ""
        already = {m.lower() for m in re.findall(r"[#@]\w+", caption)}

        extras = []
        for tag in self.options.get("hashtags") or []:
            clean = tag.lstrip("#").strip()
            if clean and f"#{clean}".lower() not in already:
                extras.append(f"#{clean}")
        for mention in self.options.get("mentions") or []:
            clean = mention.lstrip("@").strip()
            if clean and f"@{clean}".lower() not in already:
                extras.append(f"@{clean}")

        if not extras:
            return caption
        return f"{caption}\n\n{' '.join(extras)}" if caption else " ".join(extras)


class PostTarget(Base):
    __tablename__ = "post_targets"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("social_accounts.id"), nullable=False)
    platform = Column(Enum(Platform), nullable=False)
    status = Column(Enum(TargetStatus), default=TargetStatus.pending)
    external_post_id = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    # Si renseigné, remplace Post.scheduled_at pour CETTE plateforme uniquement
    # (permet de publier le même contenu à des horaires différents par réseau).
    scheduled_at = Column(DateTime, nullable=True)

    post = relationship("Post", back_populates="targets")
    account = relationship("SocialAccount", back_populates="targets")
    stats = relationship("StatSnapshot", back_populates="target", cascade="all, delete-orphan")


class StatSnapshot(Base):
    __tablename__ = "stat_snapshots"

    id = Column(Integer, primary_key=True)
    target_id = Column(Integer, ForeignKey("post_targets.id"), nullable=False)
    captured_at = Column(DateTime, default=datetime.utcnow)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)

    target = relationship("PostTarget", back_populates="stats")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True)
    platform = Column(Enum(Platform), nullable=False)
    account_id = Column(Integer, ForeignKey("social_accounts.id"), nullable=False)
    external_id = Column(String, nullable=True)
    participant_name = Column(String, nullable=False, default="")
    participant_avatar = Column(String, nullable=True)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    unread = Column(Boolean, default=True)
    simulated = Column(Boolean, default=True)

    account = relationship("SocialAccount")
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.sent_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    direction = Column(Enum(MessageDirection), nullable=False)
    text = Column(Text, nullable=False, default="")
    sent_at = Column(DateTime, default=datetime.utcnow)
    external_id = Column(String, nullable=True)

    conversation = relationship("Conversation", back_populates="messages")


class AdCampaign(Base):
    __tablename__ = "ad_campaigns"

    id = Column(Integer, primary_key=True)
    platform = Column(Enum(Platform), nullable=False)
    account_id = Column(Integer, ForeignKey("social_accounts.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True)
    name = Column(String, nullable=False)
    objective = Column(Enum(CampaignObjective), default=CampaignObjective.awareness)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.draft)
    daily_budget = Column(Float, default=0.0)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    simulated = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Utilisés uniquement pour une campagne créée sans publication liée (visuel propre à la pub).
    # Quand post_id est renseigné (mode "boost"), le visuel/texte de la publication sont utilisés directement.
    creative_caption = Column(Text, nullable=True)
    media_path = Column(String, nullable=True)
    media_type = Column(String, nullable=True)

    account = relationship("SocialAccount")
    post = relationship("Post")
    stats = relationship("AdStatSnapshot", back_populates="campaign", cascade="all, delete-orphan")


class AdStatSnapshot(Base):
    __tablename__ = "ad_stat_snapshots"

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("ad_campaigns.id"), nullable=False)
    captured_at = Column(DateTime, default=datetime.utcnow)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    spend = Column(Float, default=0.0)
    conversions = Column(Integer, default=0)

    campaign = relationship("AdCampaign", back_populates="stats")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    platform = Column(Enum(Platform), nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True)
    path = Column(String, nullable=False)
    media_type = Column(String, nullable=False)  # image | video
    original_filename = Column(String, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class EditorialEvent(Base):
    """Événement éditorial saisi manuellement sur le calendrier : tournage, séance
    photo, parution presse, événement terrain... Distinct des publications (Post),
    qui restent gérées via le composer."""

    __tablename__ = "editorial_events"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    event_type = Column(Enum(EditorialEventType), nullable=False, default=EditorialEventType.evenement)
    event_date = Column(DateTime, nullable=False)  # heure de Paris, stockée en UTC comme le reste
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
