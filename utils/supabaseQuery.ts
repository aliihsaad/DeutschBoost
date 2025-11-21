import { PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js';

/**
 * Execute a Supabase query with timeout
 * @param queryPromise - The Supabase query promise
 * @param timeoutMs - Timeout in milliseconds (default 10000)
 * @returns Query result
 */
export async function withTimeout<T>(
  queryPromise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([queryPromise, timeoutPromise]);
}

/**
 * Validate single query result and extract data
 * @param result - Supabase single query result
 * @param context - Context for error messages
 * @returns The data if valid
 * @throws Error if query failed or no data
 */
export function validateSingleResult<T>(
  result: PostgrestSingleResponse<T>,
  context: string
): T {
  if (result.error) {
    // PGRST116 means no rows found
    if (result.error.code === 'PGRST116') {
      throw new Error(`No ${context} found`);
    }
    throw new Error(`Failed to fetch ${context}: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error(`No ${context} data returned`);
  }

  return result.data;
}

/**
 * Validate array query result
 * @param result - Supabase query result
 * @param context - Context for error messages
 * @returns The data array (empty if no results)
 */
export function validateArrayResult<T>(
  result: PostgrestResponse<T>,
  context: string
): T[] {
  if (result.error) {
    throw new Error(`Failed to fetch ${context}: ${result.error.message}`);
  }

  return result.data ?? [];
}

/**
 * User-friendly error messages for common Supabase errors
 */
export function getUserFriendlyError(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('timeout')) {
    return 'The request took too long. Please check your connection and try again.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }

  if (message.includes('not found') || message.includes('pgrst116')) {
    return 'The requested data was not found.';
  }

  if (message.includes('permission') || message.includes('rls')) {
    return 'You do not have permission to access this data.';
  }

  if (message.includes('duplicate') || message.includes('unique')) {
    return 'This item already exists.';
  }

  // Default to original message for unknown errors
  return error.message;
}
