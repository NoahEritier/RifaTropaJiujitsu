ALTER TABLE requests ADD COLUMN token_hash TEXT;
ALTER TABLE requests ADD COLUMN fingerprint TEXT;
ALTER TABLE requests ADD COLUMN numbers TEXT NOT NULL DEFAULT '[]';
ALTER TABLE requests ADD COLUMN expires INTEGER NOT NULL DEFAULT 0;
UPDATE requests SET numbers = COALESCE(
  (SELECT json_group_array(number) FROM (SELECT number FROM tickets WHERE request_id = requests.id ORDER BY number)),
  '[]'
);
UPDATE requests SET expires = created + 172800000 WHERE status = 'pending';
CREATE UNIQUE INDEX requests_token ON requests(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX requests_status_expires ON requests(status, expires);
CREATE INDEX requests_created ON requests(created);
CREATE INDEX tickets_request ON tickets(request_id);
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(reset_at);
CREATE TRIGGER settings_numbering_lock BEFORE UPDATE OF value ON settings
WHEN EXISTS(SELECT 1 FROM requests) AND (
  json_extract(NEW.value, '$.start') != json_extract(OLD.value, '$.start')
  OR json_extract(NEW.value, '$.numberingConfirmed') != 1
)
BEGIN SELECT RAISE(ABORT, 'numbering_locked'); END;
CREATE TRIGGER settings_numbering_delete BEFORE DELETE ON settings
WHEN EXISTS(SELECT 1 FROM requests)
BEGIN SELECT RAISE(ABORT, 'numbering_locked'); END;
CREATE TRIGGER request_validation BEFORE INSERT ON requests
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM settings WHERE id=1 AND
      json_extract(value, '$.open')=1 AND json_extract(value, '$.numberingConfirmed')=1
      AND length(json_extract(value, '$.alias')) > 0
      AND length(json_extract(value, '$.holder')) > 0
      AND length(json_extract(value, '$.phone')) > 0
      AND length(json_extract(value, '$.date')) > 0
      AND length(json_extract(value, '$.mechanism')) > 0
      AND length(json_extract(value, '$.optionalPrize')) > 0
      AND length(json_extract(value, '$.rules')) > 0
  ) THEN RAISE(ABORT, 'reservations_closed') END;
  SELECT CASE WHEN NEW.status != 'pending' OR json_array_length(NEW.numbers) NOT IN (1,2)
    OR NEW.total != CASE json_array_length(NEW.numbers) WHEN 1 THEN 12000 ELSE 20000 END
    OR NEW.token_hash IS NULL OR NEW.fingerprint IS NULL OR NEW.expires <= NEW.created
    THEN RAISE(ABORT, 'invalid_request') END;
END;
CREATE TRIGGER ticket_validation BEFORE INSERT ON tickets
BEGIN
  SELECT CASE WHEN NEW.number < (SELECT json_extract(value,'$.start') FROM settings WHERE id=1)
    OR NEW.number > (SELECT json_extract(value,'$.start')+99 FROM settings WHERE id=1)
    OR NOT EXISTS(SELECT 1 FROM requests r,json_each(r.numbers) n
      WHERE r.id=NEW.request_id AND r.status='pending' AND n.value=NEW.number)
    THEN RAISE(ABORT, 'invalid_ticket') END;
END;
CREATE TRIGGER approval_validation BEFORE UPDATE OF status ON requests
WHEN NEW.status='approved'
BEGIN
  SELECT CASE WHEN OLD.status!='pending'
    OR OLD.expires <= CAST(strftime('%s','now') AS INTEGER)*1000
    OR (SELECT COUNT(*) FROM tickets WHERE request_id=OLD.id) != json_array_length(OLD.numbers)
    THEN RAISE(ABORT,'cannot_approve') END;
END;
CREATE TRIGGER release_tickets AFTER UPDATE OF status ON requests
WHEN NEW.status IN ('expired','rejected')
BEGIN DELETE FROM tickets WHERE request_id=NEW.id; END;