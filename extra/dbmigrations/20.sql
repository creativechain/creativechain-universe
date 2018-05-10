CREATE TABLE IF NOT EXISTS "Download" (
	`cid`	TEXT NOT NULL,
	`name`	TEXT NOT NULL,
	`destiny`	TEXT NOT NULL,
	`file_size`	INTEGER NOT NULL,
	`content_id`	TEXT NOT NULL,
	`content_type`	TEXT,
	`price`	INTEGER,
	PRIMARY KEY(`cid`)
);