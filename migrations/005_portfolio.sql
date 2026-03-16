-- migrations/005_portfolio.sql
-- hero_photos, portfolio_categories, portfolio_photos, contact_submissions
-- Adds portfolio and settings columns to app_settings

CREATE TABLE hero_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE portfolio_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    cover_url TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE portfolio_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES portfolio_categories(id) ON DELETE RESTRICT,
    image_url TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add portfolio and settings columns to existing app_settings row
ALTER TABLE app_settings
    ADD COLUMN tagline TEXT,
    ADD COLUMN bio TEXT,
    ADD COLUMN instagram_url TEXT,
    ADD COLUMN facebook_url TEXT,
    ADD COLUMN contact_headline TEXT,
    ADD COLUMN contact_email TEXT;

-- Indexes
CREATE INDEX ON hero_photos (position);
CREATE INDEX ON portfolio_categories (position);
CREATE INDEX ON portfolio_photos (category_id, position);
CREATE INDEX ON contact_submissions (created_at DESC);
