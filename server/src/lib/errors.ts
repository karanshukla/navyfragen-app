// Extracts `.message` from an unknown catch value, or "" if the value isn't
// Error-shaped. Callers pair it with a fallback (e.g. `errorMessage(err) ||
// "Failed..."`) so non-Error throws still produce a useful message — matching
// the pre-`unknown` `err.message || "..."` behavior the tests rely on.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    return typeof msg === "string" ? msg : "";
  }
  return "";
}
