CREATE TABLE votes (
    poll_id TEXT NOT NULL,
    name TEXT NOT NULL,
    response_code TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (poll_id, name)
);
