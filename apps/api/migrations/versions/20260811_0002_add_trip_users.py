"""Add user ownership to trips while preserving legacy data.

Revision ID: 20260811_0002
Revises: 20260811_0001
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260811_0002"
down_revision: Union[str, Sequence[str], None] = "20260811_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("google_subject", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("picture_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("google_subject", name="uq_users_google_subject"),
    )

    connection = op.get_bind()
    legacy_user_id = connection.execute(
        sa.text("INSERT INTO users (name) VALUES (:name) RETURNING id"),
        {"name": "Legacy User"},
    ).scalar_one()

    # Add without a default, backfill every existing trip, then enforce ownership.
    op.add_column("trips", sa.Column("user_id", sa.Integer(), nullable=True))
    connection.execute(
        sa.text("UPDATE trips SET user_id = :user_id WHERE user_id IS NULL"),
        {"user_id": legacy_user_id},
    )
    op.alter_column("trips", "user_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        "fk_trips_user_id_users",
        "trips",
        "users",
        ["user_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_trips_user_id", "trips", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_trips_user_id", table_name="trips")
    op.drop_constraint("fk_trips_user_id_users", "trips", type_="foreignkey")
    op.drop_column("trips", "user_id")
    op.drop_table("users")
