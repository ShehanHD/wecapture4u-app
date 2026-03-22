-- Remove fields from jobs that are sourced from the linked appointment
ALTER TABLE jobs DROP COLUMN IF EXISTS title;
ALTER TABLE jobs DROP COLUMN IF EXISTS shoot_date;
ALTER TABLE jobs DROP COLUMN IF EXISTS delivery_deadline;
ALTER TABLE jobs DROP COLUMN IF EXISTS notes;
ALTER TABLE jobs DROP COLUMN IF EXISTS price;
