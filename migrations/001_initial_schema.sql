-- migrations/001_initial_schema.sql
-- Core tables: users, clients, session_types, appointments, job_stages,
-- jobs, invoices, invoice_items, app_settings, notifications, password_reset_tokens
--
-- NOTE: deposit_account_id (appointments) and revenue_account_id (invoice_items)
-- are added in 003_accounting.sql after the accounts table exists.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'client');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partially_paid', 'paid');

-- users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role user_role NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- clients
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    birthday DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- session_types
CREATE TABLE session_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- job_stages
CREATE TABLE job_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    position INTEGER NOT NULL,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default job stages
INSERT INTO job_stages (name, color, position, is_terminal) VALUES
    ('Booked',    '#f59e0b', 1, FALSE),
    ('Shooting',  '#3b82f6', 2, FALSE),
    ('Editing',   '#8b5cf6', 3, FALSE),
    ('Delivered', '#10b981', 4, TRUE),
    ('Archived',  '#6b7280', 5, TRUE);

-- appointments
-- deposit_account_id FK added in 003_accounting.sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    session_type_id UUID REFERENCES session_types(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    location TEXT,
    status appointment_status NOT NULL DEFAULT 'pending',
    addons TEXT[] NOT NULL DEFAULT '{}',
    deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
    deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    contract_signed BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- jobs
-- delivery_url added in 004_client_portal.sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    stage_id UUID NOT NULL REFERENCES job_stages(id) ON DELETE RESTRICT,
    shoot_date DATE,
    delivery_deadline DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    status invoice_status NOT NULL DEFAULT 'draft',
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    due_date DATE,
    sent_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- invoice_items
-- revenue_account_id FK added in 003_accounting.sql
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- app_settings (single-row table, always id = 1)
-- Portfolio columns added in 005_portfolio.sql
-- SEO columns added in 006_seo.sql
CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    pdf_invoices_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT app_settings_single_row CHECK (id = 1)
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    sent_email BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- password_reset_tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON appointments (client_id);
CREATE INDEX ON appointments (starts_at);
CREATE INDEX ON jobs (client_id);
CREATE INDEX ON jobs (stage_id);
CREATE INDEX ON invoices (client_id);
CREATE INDEX ON invoices (status);
CREATE INDEX ON notifications (user_id, read);
CREATE INDEX ON notifications (created_at DESC);
CREATE INDEX ON password_reset_tokens (token_hash);
