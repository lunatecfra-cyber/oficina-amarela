-- Yellow Workshop Database Schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  google_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('spokesperson', 'editor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_sessions_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  headline TEXT,
  bio TEXT,
  location TEXT,
  delivered_count INT NOT NULL DEFAULT 0,
  reputation INT NOT NULL DEFAULT 0,
  streak INT NOT NULL DEFAULT 0,
  rating NUMERIC(3,2),
  tier TEXT GENERATED ALWAYS AS (
    CASE
      WHEN delivered_count >= 60 THEN 'Master Artisan'
      WHEN delivered_count >= 30 THEN 'Craftsman'
      WHEN delivered_count >= 10 THEN 'Journeyman'
      ELSE 'Apprentice'
    END
  ) STORED,
  booking_locked_until TIMESTAMPTZ,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  banned_at TIMESTAMPTZ,
  ban_reason TEXT,
  software_tools TEXT[],
  editing_styles TEXT[],
  portfolio_link TEXT,
  availability JSONB,
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  editing_level TEXT,
  pc_setup TEXT,
  niches TEXT[],
  avatar_url TEXT,
  political_office TEXT,
  running_for TEXT,
  election_year TEXT,
  campaign_flags TEXT[],
  communication_tone TEXT,
  keywords TEXT[],
  social_links JSONB,
  watermark TEXT,
  campaign_tax_id TEXT,
  voter_id TEXT,
  last_seen_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users (lower(handle));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  first_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS portfolio (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('short', 'long')),
  spokesperson TEXT NOT NULL,
  tint TEXT,
  video_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio (user_id);

CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements (user_id);

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  spokesperson_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('short', 'long')),
  brief_tone TEXT,
  brief_color TEXT,
  brief_font TEXT,
  brief_references TEXT,
  drive_link TEXT,
  youtube_link TEXT,
  raw_video_url TEXT,
  delivery_video_url TEXT,
  watermark TEXT,
  campaign_tax_id TEXT,
  voter_id TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'offered', 'reserved', 'in_review', 'revision_requested', 'approved', 'completed')),
  reserved_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ,
  delivery_link TEXT,
  inspector_notes TEXT,
  extras TEXT,
  motivation TEXT,
  desired_deadline DATE,
  priority INT NOT NULL DEFAULT 0,
  is_scored BOOLEAN NOT NULL DEFAULT false,
  revision_requested_by TEXT CHECK (revision_requested_by IN ('inspector', 'spokesperson')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missions_status ON missions (status);
CREATE INDEX IF NOT EXISTS idx_missions_spokesperson ON missions (spokesperson_id);
CREATE INDEX IF NOT EXISTS idx_missions_queue ON missions (priority DESC, created_at ASC)
  WHERE status IN ('available', 'offered');

CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  mission_id INT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  order_index INT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_one_pending_per_mission
  ON offers (mission_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_one_pending_per_editor
  ON offers (editor_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_offers_mission ON offers (mission_id);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  mission_id INT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_editor ON reviews (editor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_mission ON reviews (mission_id);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  mission_id INT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_mission ON messages (mission_id);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  mission_id INT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id INT REFERENCES users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  url TEXT NOT NULL,
  size INTEGER,
  added_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_tags ON music_tracks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_music_created ON music_tracks (created_at DESC);

CREATE TABLE IF NOT EXISTS gamification_rules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  xp INT NOT NULL CHECK (xp > 0),
  cycle TEXT NOT NULL CHECK (cycle IN ('daily', 'one_time')),
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO gamification_rules (id, title, description, xp, cycle)
VALUES
  ('daily_login', 'Visited the workshop', 'Logged into Yellow Workshop today.', 10, 'daily'),
  ('mission_delivered', 'Delivered a mission', 'Submitted a valid video edit for review.', 40, 'one_time')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  xp = EXCLUDED.xp,
  cycle = EXCLUDED.cycle,
  is_active = true;

CREATE TABLE IF NOT EXISTS gamification_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES gamification_rules(id),
  reference TEXT NOT NULL,
  xp INT NOT NULL CHECK (xp > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_gamification_events_user_date
  ON gamification_events (user_id, created_at DESC);
