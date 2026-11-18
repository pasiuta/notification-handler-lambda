// Converts a date-like string to ISO 8601.
export const toIsoDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
