-- migrations/006_seo.sql
-- Adds SEO and Open Graph columns to app_settings
-- Depends on 001 (which creates app_settings row) — run after all prior migrations

ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS meta_title TEXT,
    ADD COLUMN IF NOT EXISTS meta_description TEXT,
    ADD COLUMN IF NOT EXISTS og_image_url TEXT;
