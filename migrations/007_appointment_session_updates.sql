-- 007: appointment session updates
-- - Add session_time (morning / afternoon / evening)
-- - Replace session_type_id (single FK) with session_type_ids (UUID array, multi-select)

ALTER TABLE appointments
  drop column session_time,
  drop column session_type_ids;


ALTER TABLE appointments
  ADD COLUMN session_time VARCHAR,
  ADD COLUMN session_type_ids UUID[] NOT NULL DEFAULT '{}';
