-- Bases migradas podem ter created_at sem DEFAULT. Só data novas inserções;
-- datas históricas ausentes continuam desconhecidas.
CREATE TRIGGER IF NOT EXISTS user_created_at_insert
AFTER INSERT ON users
WHEN NEW.created_at IS NULL
BEGIN
  UPDATE users SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
