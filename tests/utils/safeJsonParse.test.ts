import { describe, it, expect } from 'vitest';
import { safeJsonParse, extractJsonFromText, parseAiJsonResponse } from '../../utils/safeJsonParse';

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('should return null for invalid JSON', () => {
    const result = safeJsonParse('invalid json');
    expect(result).toBeNull();
  });

  it('should return fallback for invalid JSON when provided', () => {
    const fallback = { default: true };
    const result = safeJsonParse('invalid json', fallback);
    expect(result).toEqual(fallback);
  });

  it('should handle empty string', () => {
    const result = safeJsonParse('');
    expect(result).toBeNull();
  });

  it('should parse arrays', () => {
    const result = safeJsonParse<string[]>('["a", "b", "c"]');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should parse nested objects', () => {
    const result = safeJsonParse<{ user: { name: string } }>('{"user": {"name": "John"}}');
    expect(result).toEqual({ user: { name: 'John' } });
  });
});

describe('extractJsonFromText', () => {
  it('should extract JSON from markdown code block', () => {
    const text = '```json\n{"key": "value"}\n```';
    const result = extractJsonFromText(text);
    expect(result).toBe('{"key": "value"}');
  });

  it('should extract JSON from code block without language', () => {
    const text = '```\n{"key": "value"}\n```';
    const result = extractJsonFromText(text);
    expect(result).toBe('{"key": "value"}');
  });

  it('should return original text if no code block', () => {
    const text = '{"key": "value"}';
    const result = extractJsonFromText(text);
    expect(result).toBe('{"key": "value"}');
  });

  it('should trim whitespace', () => {
    const text = '  {"key": "value"}  ';
    const result = extractJsonFromText(text);
    expect(result).toBe('{"key": "value"}');
  });

  it('should handle multiline JSON in code block', () => {
    const text = '```json\n{\n  "key": "value",\n  "number": 42\n}\n```';
    const result = extractJsonFromText(text);
    expect(result).toContain('"key": "value"');
    expect(result).toContain('"number": 42');
  });
});

describe('parseAiJsonResponse', () => {
  it('should parse valid AI response', () => {
    const text = '{"level": "A2", "score": 85}';
    const result = parseAiJsonResponse<{ level: string; score: number }>(text, 'test');
    expect(result).toEqual({ level: 'A2', score: 85 });
  });

  it('should parse AI response with code block', () => {
    const text = '```json\n{"level": "B1"}\n```';
    const result = parseAiJsonResponse<{ level: string }>(text, 'test');
    expect(result).toEqual({ level: 'B1' });
  });

  it('should throw error for invalid JSON', () => {
    expect(() => {
      parseAiJsonResponse('invalid', 'test context');
    }).toThrow('Failed to parse test context response');
  });

  it('should include context in error message', () => {
    expect(() => {
      parseAiJsonResponse('not json', 'grammar activity');
    }).toThrow('grammar activity');
  });
});
