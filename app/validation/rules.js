// A rule is a pure function: (rawValue) => { value } | { error }.
// Rules can be combined in a schema, and a new rule is just one more small function.
const ok = (value) => ({ value });
const fail = (error) => ({ error });

// Practical email check (WHATWG HTML spec pattern): it rejects "bob(at)example.com" and "a@b".
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const text = (v) =>
  typeof v === 'string' && v.trim() ? ok(v.trim()) : fail('must be a non-empty string');

export const email = (v) =>
  typeof v === 'string' && EMAIL.test(v.trim()) ? ok(v.trim().toLowerCase()) : fail('must be a valid email');

// "admin, editor , manager" | ["viewer", " "] | null  ->  ["admin", "editor", "manager"] | ["viewer"] | []
// Trimmed, lowercased, without blanks or duplicates.
export const stringList = (v) => {
  if (v == null) return ok([]);
  const items = typeof v === 'string' ? v.split(',') : v;
  if (!Array.isArray(items) || !items.every((i) => typeof i === 'string')) {
    return fail('must be a comma-separated string or an array of strings');
  }
  return ok([...new Set(items.map((i) => i.trim().toLowerCase()).filter(Boolean))]);
};
