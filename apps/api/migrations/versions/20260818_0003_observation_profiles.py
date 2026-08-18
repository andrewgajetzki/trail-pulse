"""Add observation profiles/types and migrate legacy interactions safely.

Revision ID: 20260818_0003
Revises: 20260811_0002
Create Date: 2026-08-18

Verification queries to run before removing legacy fields in a later migration:

-- Every trip has a profile owned by the same user.
SELECT t.id
FROM trips t
LEFT JOIN observation_profiles p ON p.id = t.observation_profile_id
WHERE p.id IS NULL OR p.user_id <> t.user_id;

-- Every observation references a type belonging to its trip's profile.
SELECT o.id
FROM observations o
JOIN trips t ON t.id = o.trip_id
LEFT JOIN observation_types ot ON ot.id = o.observation_type_id
WHERE ot.id IS NULL OR ot.profile_id <> t.observation_profile_id;

-- Legacy values agree with their migrated default types.
SELECT o.id, o.interaction_type, ot.label
FROM observations o
JOIN observation_types ot ON ot.id = o.observation_type_id
WHERE (o.interaction_type = 'Greeted me' AND ot.label <> 'Greeted us')
   OR (o.interaction_type = 'No response' AND ot.label <> 'No response');
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260818_0003"
down_revision: Union[str, Sequence[str], None] = "20260811_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "observation_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_observation_profiles_user_name"),
    )
    op.create_index("ix_observation_profiles_user_id", "observation_profiles", ["user_id"])
    op.create_table(
        "observation_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("profile_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("icon", sa.String(length=32), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["profile_id"], ["observation_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "label", name="uq_observation_types_profile_label"),
    )
    op.create_index("ix_observation_types_profile_id", "observation_types", ["profile_id"])

    connection = op.get_bind()
    # Only users with existing rides receive the migrated default profile.
    connection.execute(sa.text("""
        INSERT INTO observation_profiles (user_id, name, is_active)
        SELECT DISTINCT t.user_id, 'Trail Friendliness', true
        FROM trips t
        ON CONFLICT (user_id, name) DO NOTHING
    """))
    connection.execute(sa.text("""
        INSERT INTO observation_types (profile_id, label, icon, sort_order, is_active)
        SELECT p.id, v.label, v.icon, v.sort_order, true
        FROM observation_profiles p
        CROSS JOIN (VALUES
            ('Greeted us', '🙂', 1),
            ('No response', '😐', 2)
        ) AS v(label, icon, sort_order)
        WHERE p.name = 'Trail Friendliness'
        ON CONFLICT (profile_id, label) DO NOTHING
    """))
    # Preserve unexpected legacy labels rather than silently changing their meaning.
    connection.execute(sa.text("""
        INSERT INTO observation_types (profile_id, label, icon, sort_order, is_active)
        SELECT DISTINCT p.id, i.interaction_type, '•', 1000, true
        FROM interactions i
        JOIN trips t ON t.id = i.trip_id
        JOIN observation_profiles p ON p.user_id = t.user_id AND p.name = 'Trail Friendliness'
        WHERE i.interaction_type NOT IN ('Greeted me', 'No response')
        ON CONFLICT (profile_id, label) DO NOTHING
    """))

    op.add_column("trips", sa.Column("observation_profile_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_trips_observation_profile_id", "trips", "observation_profiles", ["observation_profile_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_trips_observation_profile_id", "trips", ["observation_profile_id"])
    connection.execute(sa.text("""
        UPDATE trips t
        SET observation_profile_id = p.id
        FROM observation_profiles p
        WHERE p.user_id = t.user_id AND p.name = 'Trail Friendliness'
          AND t.observation_profile_id IS NULL
    """))
    op.alter_column("trips", "observation_profile_id", existing_type=sa.Integer(), nullable=False)

    op.rename_table("interactions", "observations")
    op.execute(sa.text("ALTER INDEX ix_interactions_trip_id RENAME TO ix_observations_trip_id"))
    op.add_column("observations", sa.Column("observation_type_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_observations_observation_type_id", "observations", "observation_types", ["observation_type_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_observations_observation_type_id", "observations", ["observation_type_id"])
    connection.execute(sa.text("""
        UPDATE observations o
        SET observation_type_id = ot.id
        FROM trips t, observation_profiles p, observation_types ot
        WHERE o.trip_id = t.id
          AND p.id = t.observation_profile_id
          AND ot.profile_id = p.id
          AND ot.label = CASE o.interaction_type
              WHEN 'Greeted me' THEN 'Greeted us'
              WHEN 'No response' THEN 'No response'
              ELSE o.interaction_type
          END
          AND o.observation_type_id IS NULL
    """))
    op.alter_column("observations", "observation_type_id", existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    # Downgrade keeps the legacy interaction_type values intact while restoring the table name.
    op.drop_constraint("fk_observations_observation_type_id", "observations", type_="foreignkey")
    op.drop_index("ix_observations_observation_type_id", table_name="observations")
    op.drop_column("observations", "observation_type_id")
    op.execute(sa.text("ALTER INDEX ix_observations_trip_id RENAME TO ix_interactions_trip_id"))
    op.rename_table("observations", "interactions")
    op.drop_index("ix_trips_observation_profile_id", table_name="trips")
    op.drop_constraint("fk_trips_observation_profile_id", "trips", type_="foreignkey")
    op.drop_column("trips", "observation_profile_id")
    op.drop_index("ix_observation_types_profile_id", table_name="observation_types")
    op.drop_table("observation_types")
    op.drop_index("ix_observation_profiles_user_id", table_name="observation_profiles")
    op.drop_table("observation_profiles")
