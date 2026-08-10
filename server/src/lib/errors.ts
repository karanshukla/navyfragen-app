// Returns "" rather than a placeholder so callers can spell their own fallback
// as `errorMessage(err) || "Failed to ..."`.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    return typeof msg === "string" ? msg : "";
  }
  return "";
}
