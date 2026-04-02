-- 016: add phone column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
