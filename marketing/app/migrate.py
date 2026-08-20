"""Petites migrations additives pour SQLite (pas d'Alembic pour ce projet).

Base.metadata.create_all() crée les nouvelles tables mais n'ajoute pas les
colonnes manquantes aux tables existantes : on le fait ici à la main, de
façon idempotente (sûr à ré-exécuter à chaque démarrage).
"""

from sqlalchemy import text

from app.db import engine

# table -> [(colonne, définition SQL)]
ADDITIVE_COLUMNS = {
    "posts": [
        ("post_type", "TEXT DEFAULT 'feed'"),
        ("options_json", "TEXT"),
    ],
    "post_targets": [
        ("scheduled_at", "DATETIME"),
    ],
    "ad_campaigns": [
        ("creative_caption", "TEXT"),
        ("media_path", "TEXT"),
        ("media_type", "TEXT"),
    ],
    "users": [
        ("role", "TEXT DEFAULT 'admin'"),
    ],
}


def run_additive_migrations():
    with engine.connect() as conn:
        for table, columns in ADDITIVE_COLUMNS.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for name, definition in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
        conn.commit()
