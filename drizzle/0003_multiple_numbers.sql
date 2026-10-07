DROP TRIGGER request_validation;
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
  SELECT CASE WHEN NEW.status != 'pending' OR json_array_length(NEW.numbers) NOT BETWEEN 1 AND 100
    OR NEW.total != (json_array_length(NEW.numbers) / 2) * 20000 + (json_array_length(NEW.numbers) % 2) * 12000
    OR NEW.token_hash IS NULL OR NEW.fingerprint IS NULL OR NEW.expires <= NEW.created
    THEN RAISE(ABORT, 'invalid_request') END;
END;
