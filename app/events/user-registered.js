import { text, email, isoDate, stringList } from '../validation/rules.js';

export const userRegistered = {
  type: 'user_registered',
  notificationTypeId: 1, // NotificationType.NotificationTypeID
  schema: { name: text, email, roles: stringList, joined: isoDate },
};
