import { describe, it, expect, vi } from 'vitest';
import { withTimeout, validateSingleResult, validateArrayResult, getUserFriendlyError } from '../../utils/supabaseQuery';

describe('withTimeout', () => {
  it('should resolve when promise completes before timeout', async () => {
    const promise = Promise.resolve('success');
    const result = await withTimeout(promise, 1000);
    expect(result).toBe('success');
  });

  it('should reject when promise times out', async () => {
    const slowPromise = new Promise((resolve) => {
      setTimeout(() => resolve('too late'), 5000);
    });

    await expect(withTimeout(slowPromise, 100)).rejects.toThrow('Query timed out after 100ms');
  });

  it('should pass through promise rejection', async () => {
    const failingPromise = Promise.reject(new Error('Database error'));
    await expect(withTimeout(failingPromise, 1000)).rejects.toThrow('Database error');
  });
});

describe('validateSingleResult', () => {
  it('should return data when valid', () => {
    const result = {
      data: { id: 1, name: 'test' },
      error: null,
    };
    const data = validateSingleResult(result as any, 'user');
    expect(data).toEqual({ id: 1, name: 'test' });
  });

  it('should throw for PGRST116 (no rows)', () => {
    const result = {
      data: null,
      error: { code: 'PGRST116', message: 'No rows' },
    };
    expect(() => validateSingleResult(result as any, 'user')).toThrow('No user found');
  });

  it('should throw for other errors', () => {
    const result = {
      data: null,
      error: { code: 'OTHER', message: 'Something wrong' },
    };
    expect(() => validateSingleResult(result as any, 'profile')).toThrow('Failed to fetch profile: Something wrong');
  });

  it('should throw when data is null', () => {
    const result = {
      data: null,
      error: null,
    };
    expect(() => validateSingleResult(result as any, 'plan')).toThrow('No plan data returned');
  });
});

describe('validateArrayResult', () => {
  it('should return data array when valid', () => {
    const result = {
      data: [{ id: 1 }, { id: 2 }],
      error: null,
    };
    const data = validateArrayResult(result as any, 'items');
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('should return empty array when data is null', () => {
    const result = {
      data: null,
      error: null,
    };
    const data = validateArrayResult(result as any, 'items');
    expect(data).toEqual([]);
  });

  it('should throw for errors', () => {
    const result = {
      data: null,
      error: { message: 'Query failed' },
    };
    expect(() => validateArrayResult(result as any, 'sessions')).toThrow('Failed to fetch sessions: Query failed');
  });
});

describe('getUserFriendlyError', () => {
  it('should return friendly message for timeout', () => {
    const error = new Error('timeout occurred');
    const message = getUserFriendlyError(error);
    expect(message).toContain('too long');
  });

  it('should return friendly message for network errors', () => {
    const error = new Error('Network request failed');
    const message = getUserFriendlyError(error);
    expect(message).toContain('internet connection');
  });

  it('should return friendly message for not found', () => {
    const error = new Error('Item not found');
    const message = getUserFriendlyError(error);
    expect(message).toContain('not found');
  });

  it('should return friendly message for permission errors', () => {
    const error = new Error('Permission denied by RLS policy');
    const message = getUserFriendlyError(error);
    expect(message).toContain('permission');
  });

  it('should return friendly message for duplicates', () => {
    const error = new Error('Duplicate key violates unique constraint');
    const message = getUserFriendlyError(error);
    expect(message).toContain('already exists');
  });

  it('should return original message for unknown errors', () => {
    const error = new Error('Some unknown error');
    const message = getUserFriendlyError(error);
    expect(message).toBe('Some unknown error');
  });
});
