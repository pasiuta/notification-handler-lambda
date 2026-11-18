// Converts loosely formatted dates to ISO 8601 (UTC), with the same result on every machine.
// `new Date(str)` alone is not safe here:
//   - "2021-07-15T00:00:00" (no offset) is parsed in the HOST time zone, so a laptop and Lambda disagree;
//   - "April 5th, 2021" fails because of the ordinal suffix.
// Rule: a date without an explicit offset or zone is treated as UTC.

// YYYY-MM-DD or YYYY/MM/DD, optional time, optional offset (Z, +02:00, +0200)
const ISO_LIKE =
  /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
const HAS_ZONE = /\b(?:UTC|GMT|Z|[ECMP][SD]T)\b|[+-]\d{2}:?\d{2}$/i;

const fromIsoLike = ([, y, mo, d, h = '00', mi = '00', s = '00', ms = '', tz = 'Z']) => {
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${ms}${tz.length === 5 ? `${tz.slice(0, 3)}:${tz.slice(3)}` : tz}`);
  // Reject calendar overflow such as 2021-02-30, which JS would silently roll over to March 2.
  const sameDay = new Date(`${y}-${mo}-${d}T00:00:00Z`).getUTCDate() === Number(d);
  return sameDay ? date : new Date(NaN);
};

const fromFreeText = (s) => new Date(HAS_ZONE.test(s) ? s : `${s} UTC`);

export const toIsoDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;

  const text = value.trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1'); // "5th" becomes "5"
  const match = text.match(ISO_LIKE);
  const date = match ? fromIsoLike(match) : fromFreeText(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
