CREATE TABLE IF NOT EXISTS administrators (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  licence_number VARCHAR(80),
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  registration_number VARCHAR(40) NOT NULL UNIQUE,
  vehicle_type VARCHAR(80) NOT NULL,
  vehicle_model VARCHAR(100),
  capacity VARCHAR(60),
  status VARCHAR(20) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Assigned','Active','Maintenance','Inactive')),
  assigned_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_requests (
  id BIGSERIAL PRIMARY KEY,
  reference_code VARCHAR(40) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160),
  region VARCHAR(80) NOT NULL,
  address VARCHAR(255) NOT NULL,
  waste_category VARCHAR(60) NOT NULL,
  estimated_quantity VARCHAR(80),
  preferred_date DATE,
  preferred_time VARCHAR(40),
  customer_latitude NUMERIC(10,7),
  customer_longitude NUMERIC(10,7),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Assigned','Driver En Route','Arrived','In Progress','Completed','Cancelled')),
  assigned_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collection_status ON collection_requests(status);
CREATE INDEX IF NOT EXISTS idx_collection_phone_ref ON collection_requests(phone, reference_code);

CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id BIGSERIAL PRIMARY KEY,
  collection_request_id BIGINT NOT NULL REFERENCES collection_requests(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_driver_active ON vehicle_assignments(driver_id, active);

CREATE TABLE IF NOT EXISTS vehicle_locations (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  assignment_id BIGINT NOT NULL REFERENCES vehicle_assignments(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy NUMERIC(9,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_latest ON vehicle_locations(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_latest ON vehicle_locations(assignment_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS environmental_reports (
  id BIGSERIAL PRIMARY KEY,
  reference_code VARCHAR(40) NOT NULL UNIQUE,
  reporter_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  location VARCHAR(255) NOT NULL,
  category VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  evidence_path VARCHAR(255),
  evidence_data TEXT,
  evidence_mime VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted','Under Review','Assigned','Resolved','Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_evidence (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES environmental_reports(id) ON DELETE CASCADE,
  mime_type VARCHAR(40) NOT NULL,
  filename VARCHAR(200),
  data BYTEA,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_evidence_report ON report_evidence(report_id);

CREATE TABLE IF NOT EXISTS recycling_listings (
  id BIGSERIAL PRIMARY KEY,
  seller_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  material VARCHAR(60) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  location VARCHAR(180) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Pending Review','Available','Reserved','Collected','Sold','Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recycling_transactions (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES recycling_listings(id),
  buyer_name VARCHAR(120) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  amount_ghs NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Completed','Cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES collection_requests(id) ON DELETE CASCADE,
  notification_type VARCHAR(40) NOT NULL,
  recipient VARCHAR(160),
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','skipped')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notification_request ON notification_logs(request_id, notification_type);

ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE collection_requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_collection_completed ON collection_requests(completed_at DESC);

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type VARCHAR(30) NOT NULL,
  actor_id INTEGER,
  action VARCHAR(120) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
