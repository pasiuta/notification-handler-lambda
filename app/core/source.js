// Turns any supported Lambda trigger into a plain array of raw events:
//   - a JSON array of events (the task format, direct invoke)
//   - { events: [...] }
//   - an SQS batch { Records: [{ body: "<json>" }] }: the usual way to feed a "stream" into Lambda
// A record with a body that is not valid JSON becomes `undefined`, and the processor rejects it
// as invalid, so one bad message cannot fail the whole batch.
const parseBody = (record) => {
  try {
    return JSON.parse(record.body);
  } catch {
    return undefined;
  }
};

export const extractEvents = (event) => {
  if (Array.isArray(event)) return event;
  if (Array.isArray(event?.events)) return event.events;
  if (Array.isArray(event?.Records)) return event.Records.map(parseBody);
  throw new TypeError('Expected an array of events, { events: [...] } or an SQS { Records: [...] } payload');
};
