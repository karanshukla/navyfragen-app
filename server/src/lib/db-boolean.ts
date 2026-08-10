/**
 * SQLite stores booleans as 0/1 while Postgres returns real booleans, so a
 * column read through Kysely can arrive as either shape at runtime regardless
 * of what the row type declares.
 *
 * @see [db-boolean.test.ts](../tests/db-boolean.test.ts) — pins both shapes.
 */
export function fromDbBoolean(value: unknown, whenMissing: boolean): boolean {
  if (value === undefined || value === null) return whenMissing;
  return value !== 0 && value !== false;
}

export function toDbBoolean(value: boolean): number {
  return value ? 1 : 0;
}
