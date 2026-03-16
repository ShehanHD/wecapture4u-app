-- migrations/004_client_portal.sql
-- booking_requests table + jobs.delivery_url column

CREATE TYPE time_slot AS ENUM ('morning', 'afternoon', 'evening', 'all_day');
CREATE TYPE booking_request_status AS ENUM ('pending', 'confirmed', 'rejected');

CREATE TABLE booking_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    preferred_date DATE NOT NULL,
    time_slot time_slot NOT NULL,
    session_type_id UUID REFERENCES session_types(id) ON DELETE SET NULL,
    addons TEXT[] NOT NULL DEFAULT '{}',
    message TEXT,
    status booking_request_status NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs ADD COLUMN delivery_url TEXT;

CREATE INDEX ON booking_requests (client_id);
CREATE INDEX ON booking_requests (status);
