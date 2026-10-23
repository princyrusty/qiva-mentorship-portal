-- QIVA Mentorship schema. Every statement is idempotent, so it runs safely on each start.

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  is_minor        BOOLEAN NOT NULL DEFAULT FALSE,
  guardian_name   TEXT NOT NULL DEFAULT '',
  guardian_phone  TEXT NOT NULL DEFAULT '',
  guardian_email  TEXT NOT NULL DEFAULT '',
  guardian_consent_at TIMESTAMPTZ,
  terms_accepted_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bookings (
  id              TEXT PRIMARY KEY,
  access_token    TEXT NOT NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  item_id         TEXT NOT NULL,
  item_name       TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('plan', 'single')),
  amount          INTEGER NOT NULL,
  track           TEXT NOT NULL,
  focus           TEXT NOT NULL DEFAULT '',
  about           TEXT NOT NULL DEFAULT '',
  topic           TEXT NOT NULL,
  notes           TEXT NOT NULL DEFAULT '',
  slots           JSONB NOT NULL DEFAULT '[]'::jsonb,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT NOT NULL DEFAULT '',
  is_minor        BOOLEAN NOT NULL DEFAULT FALSE,
  guardian_name   TEXT NOT NULL DEFAULT '',
  guardian_phone  TEXT NOT NULL DEFAULT '',
  guardian_email  TEXT NOT NULL DEFAULT '',
  guardian_consent BOOLEAN NOT NULL DEFAULT FALSE,
  guardian_verified BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method  TEXT NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('upi', 'cashfree')),
  utr             TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'submitted', 'verified', 'paid', 'failed', 'refunded')),
  status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled')),
  confirmed_slot  TEXT NOT NULL DEFAULT '',
  meeting_link    TEXT NOT NULL DEFAULT '',
  cf_order_id     TEXT,
  admin_notes     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_created_idx ON bookings (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_utr_key ON bookings (utr) WHERE utr IS NOT NULL;

CREATE TABLE IF NOT EXISTS payments (
  order_id    TEXT PRIMARY KEY,
  booking_id  TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  raw         JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mentor_applications (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  city            TEXT NOT NULL DEFAULT '',
  tracks          JSONB NOT NULL DEFAULT '[]'::jsonb,
  job_role        TEXT NOT NULL DEFAULT '',
  experience_years INTEGER NOT NULL DEFAULT 0,
  linkedin        TEXT NOT NULL DEFAULT '',
  languages       TEXT NOT NULL DEFAULT '',
  hours_per_month INTEGER NOT NULL DEFAULT 0,
  why             TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'shortlisted', 'interview', 'onboarded', 'rejected')),
  admin_notes     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('enquiry', 'grievance', 'data_request')),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  subject         TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL,
  booking_id      TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  admin_notes     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  actor_id    INTEGER,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_log (entity, entity_id);
