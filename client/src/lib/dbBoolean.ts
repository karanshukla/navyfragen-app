/**
 * SQLite sends 0/1 and Postgres sends false/true for the same column, so a
 * setting read off the API arrives as either shape. `whenMissing` is what an
 * absent row or an unloaded query means for this particular setting.
 *
 * @see [Customise.test.tsx](../tests/pages/Customise.test.tsx) — pins both shapes.
 */
export function dbBoolean(
  value: number | boolean | null | undefined,
  whenMissing: boolean
): boolean {
  if (value === null || value === undefined) return whenMissing;
  return value === 1 || value === true;
}
