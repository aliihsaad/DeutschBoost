/**
 * Safely parse JSON with error handling
 * @param text - The JSON string to parse
 * @param fallback - Optional fallback value if parsing fails
 * @returns Parsed object or fallback/null
 */
export function safeJsonParse<T>(text: string, fallback?: T): T | null {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback ?? null;
  }
}

/**
 * Extract JSON from a string that may contain markdown code blocks
 * @param text - Text that may contain ```json blocks
 * @returns Extracted JSON string
 */
export function extractJsonFromText(text: string): string {
  // Remove markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1]?.trim() ?? text;
  }
  return text.trim();
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 * @param text - Response text from AI
 * @param context - Context for error messages
 * @returns Parsed object
 * @throws Error with context if parsing fails
 */
export function parseAiJsonResponse<T>(text: string, context: string): T {
  const jsonText = extractJsonFromText(text);
  const result = safeJsonParse<T>(jsonText);

  if (result === null) {
    throw new Error(`Failed to parse ${context} response. Invalid JSON format.`);
  }

  return result;
}
