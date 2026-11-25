-- Minimal Cloudflare D1 schema for Pay-After-Keyframe AI video pipelines
-- All timestamps stored in UTC milliseconds.

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  external_request_id TEXT,
  paid_at INTEGER,
  error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_checkouts (
  order_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  capture_attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_events (
  event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workers (
  worker_id TEXT PRIMARY KEY,
  ready_level INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at INTEGER NOT NULL
);
