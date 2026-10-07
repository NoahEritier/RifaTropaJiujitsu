CREATE TABLE raffle_draw (
  id INTEGER PRIMARY KEY CHECK(id=1),
  winner INTEGER NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id),
  created INTEGER NOT NULL,
  start INTEGER NOT NULL CHECK(start IN (0,1)),
  snapshot TEXT NOT NULL,
  CHECK(winner>=start AND winner<=start+99)
);
CREATE TRIGGER draw_no_update BEFORE UPDATE ON raffle_draw
BEGIN SELECT RAISE(ABORT,'draw_immutable'); END;
CREATE TRIGGER draw_no_delete BEFORE DELETE ON raffle_draw
BEGIN SELECT RAISE(ABORT,'draw_immutable'); END;
CREATE TRIGGER draw_no_reopen BEFORE UPDATE OF value ON settings
WHEN EXISTS(SELECT 1 FROM raffle_draw) AND json_extract(NEW.value,'$.open')=1
BEGIN SELECT RAISE(ABORT,'draw_finished'); END;
