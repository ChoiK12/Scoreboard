CREATE TABLE IF NOT EXISTS rooms (
  room_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  etag TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rooms_expiry ON rooms(expires_at);
