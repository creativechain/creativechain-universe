BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS `Torrent` (
	`hash`	TEXT NOT NULL,
	`magnet`	TEXT NOT NULL,
	`file`	TEXT,
	PRIMARY KEY(`hash`)
);
CREATE TABLE IF NOT EXISTS "Media" (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	`address`	TEXT NOT NULL UNIQUE,
	`type`	INTEGER NOT NULL,
	`title`	TEXT,
	`description`	TEXT,
	`torrent`	TEXT,
	`author`	TEXT NOT NULL,
	PRIMARY KEY(`txid`)
);
CREATE TABLE IF NOT EXISTS "Like" (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`author`	TEXT NOT NULL,
	`content_id`	TEXT NOT NULL,
	PRIMARY KEY(`txid`),
	UNIQUE(`author`,`content_id`)
);
CREATE TABLE IF NOT EXISTS `Following` (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	`follower_address`	TEXT NOT NULL,
	`followed_address`	TEXT NOT NULL,
	`type`	INTEGER NOT NULL,
	PRIMARY KEY(`txid`),
	UNIQUE(`follower_address`,`followed_address`)
);
CREATE TABLE IF NOT EXISTS `Donation` (
	`author`	TEXT NOT NULL,
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	PRIMARY KEY(`author`,`txid`)
);
CREATE TABLE IF NOT EXISTS `Comment` (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`author`	TEXT NOT NULL,
	`content_id`	TEXT NOT NULL,
	`comment`	TEXT NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	PRIMARY KEY(`txid`)
);
CREATE TABLE IF NOT EXISTS "Author" (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	`name`	TEXT NOT NULL,
	`address`	TEXT NOT NULL,
	`email`	TEXT,
	`web`	TEXT,
	`description`	TEXT,
	`avatar`	TEXT,
	PRIMARY KEY(`txid`,`address`)
);

CREATE TABLE IF NOT EXISTS `PaymentRequest` (
	`address`	TEXT NOT NULL,
	`amount`	INTEGER NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	`label`	TEXT,
	`message`	TEXT,
	PRIMARY KEY(`address`,`amount`,`creation_date`)
);

CREATE UNIQUE INDEX IF NOT EXISTS `torrent_index` ON `Torrent` (`hash` );
CREATE UNIQUE INDEX IF NOT EXISTS `media_index` ON `Media` (`address` ,`type` ,`author`, `title` );
CREATE UNIQUE INDEX IF NOT EXISTS `like_index` ON `Like` (`author` ,`content_id` );
CREATE UNIQUE INDEX IF NOT EXISTS `follow_index` ON `Following` (`follower_address` ,`followed_address` ,`type` );
CREATE UNIQUE INDEX IF NOT EXISTS `donation_index` ON `Donation` (`author` ,`txid` );
CREATE UNIQUE INDEX IF NOT EXISTS `comment_index` ON `Comment` (`author` ,`content_id` ,`txid` );
CREATE UNIQUE INDEX IF NOT EXISTS `author_index` ON `Author` (`name` ,`address` ,`email` );
COMMIT;
