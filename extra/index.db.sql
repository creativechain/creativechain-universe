BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS `Torrent` (
	`hash`	TEXT NOT NULL,
	`magnet`	TEXT NOT NULL UNIQUE,
	`path`      TEXT NOT NULL,
	`file`	TEXT,
	PRIMARY KEY(`hash`)
);

CREATE TABLE IF NOT EXISTS "Media" (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	`author`	TEXT NOT NULL,
	`address`	TEXT NOT NULL UNIQUE,
	`type`	INTEGER NOT NULL,
	`title`	TEXT,
	`description`	TEXT,
	`content_type`	TEXT,
	`license`	INTEGER,
	`tags`	TEXT,
	`price`	INTEGER,
	`public_content`	TEXT,
	`private_content`	TEXT,
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

CREATE TABLE IF NOT EXISTS "Unlike" (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`author`	TEXT NOT NULL,
	`content_id`	TEXT NOT NULL,
	PRIMARY KEY(`txid`),
	UNIQUE(`author`,`content_id`)
);

CREATE TABLE IF NOT EXISTS "Payment" (
	`txid`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`author`	TEXT NOT NULL,
	`content_id`	TEXT NOT NULL,
	`amount`	INTEGER NOT NULL,
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
	`txid`	TEXT NOT NULL,
	`author`	TEXT NOT NULL,
	`content_id` TEXT NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	`version`	INTEGER NOT NULL,
	PRIMARY KEY(`txid`)
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
	`tags`	TEXT,
	PRIMARY KEY(`address`)
);

CREATE TABLE IF NOT EXISTS `PaymentRequest` (
	`address`	TEXT NOT NULL,
	`amount`	INTEGER NOT NULL,
	`creation_date`	INTEGER NOT NULL,
	`label`	TEXT,
	`message`	TEXT,
	PRIMARY KEY(`address`,`amount`,`creation_date`)
);

CREATE TABLE IF NOT EXISTS `AddressBook` (
	`address`	TEXT NOT NULL,
	`label`	TEXT NOT NULL UNIQUE,
	PRIMARY KEY(`address`)
);

CREATE TABLE IF NOT EXISTS `MediaTags` (
    `tag`   TEXT NOT NULL,
    `address`   TEXT NOT NULL,
    PRIMARY KEY(`tag`, `address`)
);

CREATE TABLE IF NOT EXISTS `UserTags` (
    `tag`   TEXT NOT NULL,
    `address`   TEXT NOT NULL,
    PRIMARY KEY(`tag`, `address`)
);

CREATE TABLE IF NOT EXISTS `Platform` (
    `version`   TEXT,
    `lastExploredBlock` INTEGER
);

CREATE TABLE IF NOT EXISTS `Notifications` (
    `author`    TEXT NOT NULL,
    `type`      INTEGER NOT NULL,
    `resource`  TEXT NOT NULL,
    `viewed`    INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS `torrent_index` ON `Torrent` (`hash`, `magnet`);
CREATE UNIQUE INDEX IF NOT EXISTS `media_index` ON `Media` (`address` ,`type` ,`author`, `title` );
CREATE UNIQUE INDEX IF NOT EXISTS `like_index` ON `Like` (`author` ,`content_id` );
CREATE UNIQUE INDEX IF NOT EXISTS `follow_index` ON `Following` (`follower_address` ,`followed_address` ,`type` );
CREATE UNIQUE INDEX IF NOT EXISTS `donation_index` ON `Donation` (`author` ,`txid`, `content_id` );
CREATE UNIQUE INDEX IF NOT EXISTS `comment_index` ON `Comment` (`author` ,`content_id` ,`txid` );
CREATE UNIQUE INDEX IF NOT EXISTS `author_index` ON `Author` (`name` ,`address` ,`email` );
CREATE UNIQUE INDEX IF NOT EXISTS `media_tags_index` ON `MediaTags` (`tag`);
CREATE UNIQUE INDEX IF NOT EXISTS `user_tags_index` ON `UserTags` (`tag`);
COMMIT;
