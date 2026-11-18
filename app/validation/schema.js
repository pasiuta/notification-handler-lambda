// Applies a { field: rule } schema to a raw object.
// It collects ALL errors at once (not only the first), so one log line explains the whole problem.
// Only fields listed in the schema are kept: unknown or unexpected fields never reach the database.
export const validate = (schema, input) => {
  const data = {};
  const errors = [];

  for (const [field, rule] of Object.entries(schema)) {
    const result = rule(input[field]);
    if ('error' in result) errors.push(`${field} ${result.error}`);
    else data[field] = result.value;
  }
  return errors.length ? { errors } : { data };
};
