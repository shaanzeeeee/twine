"""add guest and soft delete fields

Revision ID: 20260413_0001
Revises:
Create Date: 2026-04-13 00:00:00

"""

from alembic import op
import sqlalchemy as sa


revision = "20260413_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat_sessions", sa.Column("guest_name", sa.String(length=100), nullable=True))
    op.add_column(
        "chat_sessions",
        sa.Column("review_status", sa.String(length=50), nullable=False, server_default="pending_review"),
    )
    op.add_column("chat_sessions", sa.Column("discarded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("chat_sessions", sa.Column("discard_reason", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_sessions", "discard_reason")
    op.drop_column("chat_sessions", "discarded_at")
    op.drop_column("chat_sessions", "review_status")
    op.drop_column("chat_sessions", "guest_name")
