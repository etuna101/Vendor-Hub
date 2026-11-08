export async function getEdgeFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;

  const functionError = error as { context?: unknown; message?: string };
  const context = functionError.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
      if (typeof body?.message === "string") return body.message;
    } catch {
      try {
        const text = await context.clone().text();
        if (text) return text;
      } catch {
        // Fall through to the SDK error message.
      }
    }
  }

  return functionError.message ?? null;
}
