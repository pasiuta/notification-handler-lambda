// Maps a validated event to a row of the `Notification` table (see db/schema.sql).
// Columns with DB defaults (NotificationID, Created, Seen, IsBookmarked) are left to MySQL.
export const Status = Object.freeze({ INBOX: 0, ARCHIVED: 1, DELETED: 2 });
export const CreatedByType = Object.freeze({ SYSTEM: 0 }); // incoming events are system-generated
const SYSTEM_USER_ID = 0;

export const toNotificationRow = (definition, data, eventId) => ({
  NotificationTypeID: definition.notificationTypeId,
  Status: Status.INBOX,
  NotificationData: JSON.stringify({ ...data, ...(eventId && { eventId }) }),
  CreatedByType: CreatedByType.SYSTEM,
  CreatedByID: SYSTEM_USER_ID,
});
