import { email, isoDate } from '../validation/rules.js';

export const passwordReset = {
  type: 'password_reset',
  notificationTypeId: 2,
  schema: { email, requested: isoDate },
};
