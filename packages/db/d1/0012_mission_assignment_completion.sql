CREATE TRIGGER finish_mission_assignment
AFTER UPDATE OF status ON missions
WHEN NEW.status='finalizada' AND OLD.status<>'finalizada'
BEGIN
  UPDATE mission_assignments
  SET ended_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),end_reason='finalizada'
  WHERE mission_id=NEW.id AND ended_at IS NULL;
END;
