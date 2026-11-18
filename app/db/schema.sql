-- Reference schema (not required by the task; the DB is simulated).

CREATE TABLE `NotificationType` (
  `NotificationTypeID` TINYINT UNSIGNED NOT NULL,
  `Name` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`NotificationTypeID`),
  UNIQUE KEY `uq_name` (`Name`)
);

INSERT INTO `NotificationType` (`NotificationTypeID`, `Name`) VALUES
  (1, 'user_registered'),
  (2, 'password_reset'),
  (3, 'user_deleted');

CREATE TABLE `Notification` (
  `NotificationID` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `Created` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `Status` TINYINT UNSIGNED NOT NULL DEFAULT '0' COMMENT '0 = inbox, 1 = archived, 2 = deleted',
  `NotificationTypeID` TINYINT UNSIGNED NOT NULL COMMENT 'Global values. See NotificationType table',
  `NotificationData` JSON DEFAULT NULL,
  `CreatedByType` TINYINT UNSIGNED NOT NULL,
  `CreatedByID` INT UNSIGNED NOT NULL,
  `Seen` TINYINT UNSIGNED NOT NULL DEFAULT '0' COMMENT '0 = unseen, 1 = seen',
  `IsBookmarked` TINYINT UNSIGNED NOT NULL DEFAULT '0' COMMENT '0 = no, 1 = yes',
  PRIMARY KEY (`NotificationID`),
  -- Suggested additions for production:
  -- `EventID` VARCHAR(64) GENERATED ALWAYS AS (`NotificationData`->>'$.eventId') STORED,
  -- UNIQUE KEY `uq_event` (`EventID`),          -- idempotency across invocations and retries
  KEY `idx_type_status` (`NotificationTypeID`, `Status`)
);
