/**
 * Safely parses a JSON string, returning a fallback value if parsing fails
 * or if the input is null / undefined / not valid JSON.
 */
export function safeJsonParse<T>(input: unknown, fallback: T): T {
  if (typeof input !== 'string') return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // If it was wrapped in markdown or surrounded by extra text, try regex extraction
    try {
      const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        return JSON.parse(match[0]) as T;
      }
    } catch {
      // ignore
    }
    return fallback;
  }
}
