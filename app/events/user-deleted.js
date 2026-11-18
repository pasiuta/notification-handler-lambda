import { email, isoDate } from '../validation/rules.js';

export const userDeleted = {
  type: 'user_deleted',
  notificationTypeId: 3,
  schema: { email, deleted: isoDate },
};
