// Turns the Lambda payload into a plain array of raw events:
//   - a JSON array of events (the task format, direct invoke)
//   - { events: [...] }
export const extractEvents = (event) => {
  if (Array.isArray(event)) return event;
  if (Array.isArray(event?.events)) return event.events;
  throw new TypeError('Expected an array of events or { events: [...] }');
};
