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
