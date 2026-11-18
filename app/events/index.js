import { userRegistered } from './user-registered.js';
import { passwordReset } from './password-reset.js';
import { userDeleted } from './user-deleted.js';

// Event type registry. Each event type is a declarative definition: { type, notificationTypeId, schema }.
// To add a new type, create one file like user-deleted.js and add it to this list. The pipeline does not change.
const definitions = [userRegistered, passwordReset, userDeleted];

export const eventTypes = new Map(definitions.map((d) => [d.type, d]));
