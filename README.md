# Notification Handler Lambda

An AWS Lambda function in Node.js that takes a stream of semi-structured events, **validates** and **normalizes** them, and stores them as rows of the MySQL `Notification` table. The database is simulated with `insertToMySQL()`.

- Supports 3 event types out of the box (`user_registered`, `password_reset`, `user_deleted`). **A new type is one small declarative file.**
- `roles` is normalized into a clean array of strings, emails are validated, and every date is converted to **ISO 8601 (UTC)** with the same result on every machine.
- Invalid events are **logged and skipped**. The rest of the batch always continues.
- Events are deduplicated by `event_id` (or by content when there is no id).
- Accepts a plain JSON array (the task format), `{ events: [...] }` or an **SQS batch**, with partial-batch retries.
- **Zero runtime dependencies.** It uses only Node.js built-ins, so there is no supply-chain risk and the cold start is tiny.

---

## Quick start

Requirements: **Node.js ≥ 20.12** (22 recommended, see `.nvmrc`).

```bash
git clone <repo-url> && cd notification-handler-lambda
npm ci                                        # no dependencies to download, but this checks the lockfile

node app/run.js --input sample/events.json --log-level INFO      # the command from the task
node app/run.js --input sample/sqs-event.json --log-level INFO   # the same Lambda fed by an SQS batch
node app/run.js --input sample/events.json --log-level DEBUG     # also prints the simulated SQL INSERTs

npm test                                      # 19 tests, about 1 s
```

The result (JSON) goes to **stdout** and the structured logs go to **stderr**, so each can be redirected separately:
`node app/run.js -i sample/events.json > result.json`

---

## Example

For the task's input (`sample/events.json`), the function returns:

```json
{
  "summary": { "total": 7, "stored": 4, "rejected": 2, "duplicate": 1 },
  "results": [
    { "index": 0, "type": "user_registered", "status": "stored", "notificationId": 1,
      "data": { "name": "Alice", "email": "alice@example.com", "roles": ["admin", "editor", "manager"], "joined": "2021-04-01T00:00:00.000Z" } },
    { "index": 1, "type": "user_registered", "status": "rejected", "errors": ["email must be a valid email"] },
    { "index": 2, "type": "password_reset", "status": "stored", "notificationId": 2,
      "data": { "email": "carol@example.com", "requested": "2021-06-01T08:23:00.000Z" } },
    { "index": 3, "type": "user_deleted", "status": "stored", "notificationId": 3,
      "data": { "email": "david@example.com", "deleted": "2021-07-15T00:00:00.000Z" } },
    { "index": 4, "type": "unknown_type", "status": "rejected", "errors": ["unknown event type \"unknown_type\""] },
    { "index": 5, "type": "user_registered", "status": "stored", "notificationId": 4,
      "data": { "name": "Alice", "email": "alice@example.com", "roles": [], "joined": "2021-04-01T00:00:00.000Z" } },
    { "index": 6, "type": "user_registered", "status": "duplicate" }
  ]
}
```

Logs (one JSON line per event, plus a batch summary):

```json
{"ts":"...","level":"WARN","msg":"Event rejected","index":1,"type":"user_registered","errors":["email must be a valid email"]}
{"ts":"...","level":"WARN","msg":"Event rejected","index":4,"type":"unknown_type","errors":["unknown event type \"unknown_type\""]}
{"ts":"...","level":"INFO","msg":"Duplicate event skipped","index":6,"type":"user_registered","eventId":"dedupe-1"}
{"ts":"...","level":"INFO","msg":"Event stored","index":0,"type":"user_registered","notificationId":1}
{"ts":"...","level":"INFO","msg":"Batch processed","total":7,"stored":4,"rejected":2,"duplicate":1,"durationMs":5}
```

### How each sample event is handled

| # | Input | Result | Why |
| - | ----- | ------ | --- |
| 0 | `roles: "admin, editor , manager"` | stored, roles `["admin","editor","manager"]` | Split on commas, trimmed, lowercased |
| 1 | `bob.smith(at)example.com` | **rejected** | Invalid email. The date `April 5th, 2021 13:45 PST` is valid: the ordinal suffix is handled |
| 2 | `2021/06/01 10:23+02:00` | stored, `2021-06-01T08:23:00.000Z` | Slashes and the offset are handled, converted to UTC |
| 3 | `2021-07-15T00:00:00` | stored, `2021-07-15T00:00:00.000Z` | No offset, so treated as **UTC** (see below) |
| 4 | `unknown_type` | **rejected** | No registered handler for this type |
| 5 | `roles: null`, `event_id: dedupe-1` | stored, roles `[]` | `null` becomes an empty array |
| 6 | same `event_id: dedupe-1` | **duplicate** | The first valid occurrence wins |

### Result statuses

| Status | Meaning | Retried from SQS? |
| --- | --- | --- |
| `stored` | Validated, normalized and written to the DB | no |
| `rejected` | Not an object, unknown type, or failed validation (all errors are listed) | no: retrying would fail again |
| `duplicate` | Same `event_id` (or identical content) already handled in this batch | no |
| `failed` | Valid event, but the DB write failed | **yes** (`batchItemFailures`) |

---

## Architecture

```
app/
├── handler.js              Lambda entry point: extract events → process → summary (+ SQS batchItemFailures)
├── run.js                  Local Lambda simulator (CLI)
├── config.js               Env-driven config
├── logger.js               Structured JSON logger with levels (stderr)
├── events/                 ONE FILE PER EVENT TYPE (declarative)
│   ├── index.js            Event type registry
│   ├── user-registered.js  { type, notificationTypeId, schema: { name, email, roles, joined } }
│   ├── password-reset.js
│   └── user-deleted.js
├── validation/
│   ├── rules.js            Reusable field rules: text, email, isoDate, stringList
│   ├── schema.js           Applies a { field: rule } schema, collects all errors, drops unknown fields
│   └── date.js             Deterministic "any reasonable format" → ISO 8601 UTC converter
├── core/
│   ├── processor.js        Pipeline: resolve type → validate → dedupe → store, isolated per event
│   ├── idempotency.js      Idempotency key + per-batch guard
│   ├── source.js           Array / { events } / SQS Records → raw events
│   └── pool.js             Bounded-concurrency map that preserves order
└── db/
    ├── notification.js     Validated event → `Notification` row (column mapping, enums)
    ├── mysql.js            insertToMySQL(): simulated, parameterized INSERT (swap in mysql2 here)
    └── schema.sql          Reference DDL + NotificationType seed
```

Processing flow:

```
Lambda event ─► source ─► [raw events] ─► processor (max N concurrent DB writes, order preserved)
                                           │
               for each event:  object? ─✗─► rejected  (logged, batch continues)
                                type known? ─✗─► rejected
                                schema valid? ─✗─► rejected (all field errors listed)
                                first time seen? ─✗─► duplicate
                                insertToMySQL(row) ─✗─► failed (SQS will retry only these)
                                     │
                                  stored
```

### Design decisions

- **Event types are data, not code paths.** Each type is a declarative `{ type, notificationTypeId, schema }` object in a registry (Strategy + Registry). The pipeline never uses `switch (type)`, so adding a type never touches the pipeline.
- **Composable validation rules.** A rule is a pure function `value → { value } | { error }`. The same `email` and `isoDate` rules are reused by all types, and a new rule is a small function. The schema collects **all** errors at once, so one log line explains everything wrong with an event.
- **Whitelist, not blacklist.** Only fields declared in the schema are stored. Unexpected input such as a `password` field never reaches the database.
- **Deterministic dates.** `new Date("2021-07-15T00:00:00")` is parsed in the *host* time zone, so the same input gives different results on a laptop in Kyiv and on Lambda in UTC. `date.js` treats any value without an explicit offset as **UTC**, strips ordinals ("5th"), accepts `YYYY/MM/DD`, compact offsets (`+0200`) and zones like `PST`/`GMT`, and rejects calendar overflow (`2021-02-30`), which JS would silently turn into March 2. Tests run it under 4 time zones.
- **Idempotency.** The key is `event_id`, or a hash of the normalized content when there is no id. The first valid occurrence wins (the same semantics as a `UNIQUE` key). An invalid copy does not claim the key, and a failed DB write releases it so a retry can succeed. Across invocations, idempotency belongs to the DB: see the suggested `UNIQUE (EventID)` in `db/schema.sql`.
- **No PII in logs.** Logs contain the index, type and error messages, never names or emails.
- **SQL-injection safe.** Inserts use placeholders and parameters, exactly like `mysql2`'s `execute`.
- **Dependency injection.** `createProcessor({ eventTypes, insert, logger, concurrency })` takes everything it needs, so tests pass a fake DB without any mocking library.

### Mapping to the `Notification` table

| Column | Value |
| --- | --- |
| `NotificationTypeID` | from the event definition: `user_registered` = 1, `password_reset` = 2, `user_deleted` = 3 (seeded in `schema.sql`) |
| `Status` | `0` (inbox) |
| `NotificationData` | JSON with the normalized fields (plus `eventId` when present) |
| `CreatedByType` / `CreatedByID` | `0` / `0`: system-generated events |
| `NotificationID`, `Created`, `Seen`, `IsBookmarked` | DB defaults |

---

## Adding a new event type

For example, `email_changed`. Create `app/events/email-changed.js`:

```js
import { email, isoDate } from '../validation/rules.js';

export const emailChanged = {
  type: 'email_changed',
  notificationTypeId: 4,
  schema: { oldEmail: email, newEmail: email, changed: isoDate },
};
```

Then add it to the list in `app/events/index.js` (and to `NotificationType` in `schema.sql`). That's all: validation, normalization, dedupe, logging, storage and SQS retries work automatically. Need a new kind of field? Add one function to `validation/rules.js`.

---

## Connecting a real MySQL database

Only `app/db/mysql.js` changes (`npm i mysql2`):

```js
import mysql from 'mysql2/promise';
// Module scope: the pool is created once per container and reused by warm invocations.
const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 5 });

export async function insertToMySQL(row) {
  const { sql, params } = buildInsert(row);
  const [result] = await pool.execute(sql, params);
  return { insertId: result.insertId };
}
```

For Lambda at scale, put **RDS Proxy** in front of MySQL so that many concurrent Lambdas don't exhaust DB connections. Keep `DB_CONCURRENCY` at or below `connectionLimit`.

---

## Deployment (AWS SAM)

`template.yaml` creates the function plus an **SQS queue with a dead-letter queue**. The SQS trigger uses `ReportBatchItemFailures`, so only events with a failed DB write go back to the queue. Invalid events are not retried, and messages that keep failing move to the DLQ.

```bash
sam build && sam deploy --guided
sam local invoke NotificationHandlerFunction -e sample/sqs-event.json
```

Or zip it manually: `npm run package`, then upload `function.zip` (Node.js 22.x, handler `app/handler.handler`).

| Env variable | Default | Description |
| --- | --- | --- |
| `LOG_LEVEL` | `INFO` | `DEBUG` (includes SQL), `INFO`, `WARN` or `ERROR` |
| `DB_CONCURRENCY` | `5` | Max parallel DB writes per invocation |

---

## Testing

```bash
npm test
```

The suite uses the built-in `node:test` runner: 19 tests, no network, no database.

- `date.test.js`: every sample date format, the **same output under 4 host time zones**, invalid dates and calendar overflow.
- `validation.test.js`: valid and invalid emails, all `roles` shapes, collection of all errors, dropping of unknown fields.
- `processor.test.js`: unknown types and non-objects, row mapping, dedupe (by id and by content), invalid-first-then-valid retry, DB-failure isolation, idempotency release, order under concurrency.
- `handler.test.js`: the task's sample end-to-end, an SQS batch with a malformed body, unsupported payloads.
- `db.test.js`: parameterized SQL (an injection attempt stays in params), insert ids.

---

## Assumptions and trade-offs

- **Dates without an offset are UTC.** This is the only choice that is the same on every machine. Output is always UTC ISO 8601 (`...Z`).
- **For duplicates, the first valid event wins.** This matches `INSERT` with a unique key. If "latest wins" were needed, it would be an `UPSERT` and a one-line change in the guard.
- **Roles are lowercased and deduplicated** (`"Admin"` and `"admin"` count as one role), and an empty or `null` value becomes `[]`.
- **Email validation** uses the practical WHATWG pattern, as browsers do. Full RFC 5322 is intentionally not used, because it accepts addresses that real mail systems reject.
- The simulated DB keeps an in-memory auto-increment counter. Real persistence and cross-invocation idempotency come from MySQL.
