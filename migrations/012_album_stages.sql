-- migrations/012_album_stages.sql
-- Adds album_stages table and album_stage_id FK to jobs.
-- Depends on 001 (jobs table). Run after 011.

CREATE TABLE album_stages (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL,
    color        TEXT NOT NULL,
    position     INTEGER NOT NULL,
    is_terminal  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs
    ADD COLUMN album_stage_id UUID REFERENCES album_stages(id) ON DELETE SET NULL;

-- Seed default stages
INSERT INTO album_stages (name, color, position, is_terminal) VALUES
    ('On Hold',    '#6b7280', 1, FALSE),
    ('Selecting',  '#3b82f6', 2, FALSE),
    ('Designing',  '#8b5cf6', 3, FALSE),
    ('Printing',   '#f59e0b', 4, FALSE),
    ('Dispatched', '#ec4899', 5, FALSE),
    ('Arrived',    '#14b8a6', 6, FALSE),
    ('Delivered',  '#10b981', 7, TRUE);
