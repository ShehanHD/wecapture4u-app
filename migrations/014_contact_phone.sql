-- 014: add phone to contact_submissions
ALTER TABLE contact_submissions
    ADD COLUMN IF NOT EXISTS phone TEXT;
