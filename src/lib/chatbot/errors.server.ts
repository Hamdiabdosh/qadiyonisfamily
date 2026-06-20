export function chatErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("not configured") || msg.includes("LLM_API_KEY")) {
    return "The AI assistant is not configured on the server yet. Use the quick buttons above or open Profile to contact an admin.";
  }
  if (msg.includes("Unauthorized") || msg.includes("Forbidden")) {
    return "Please sign in again to use the full assistant.";
  }
  if (msg.includes("fetch failed") || msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
    return "The assistant is temporarily unreachable. Please try again in a moment.";
  }
  return "";
}
