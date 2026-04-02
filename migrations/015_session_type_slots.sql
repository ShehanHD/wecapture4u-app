-- migrations/015_session_type_slots.sql

-- Session types: which days of the week are available
-- 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
-- Empty array means no restriction (all days allowed)
ALTER TABLE session_types
  ADD COLUMN IF NOT EXISTS available_days INTEGER[] NOT NULL DEFAULT '{}';

-- Appointments: per-session-type slots
-- Each element: {"session_type_id": "uuid", "date": "YYYY-MM-DD", "time_slot": "morning|afternoon|evening|all_day"}
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS session_slots JSONB NOT NULL DEFAULT '[]';

-- Booking requests: per-session-type slots (same shape as appointments)
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS session_slots JSONB NOT NULL DEFAULT '[]';
