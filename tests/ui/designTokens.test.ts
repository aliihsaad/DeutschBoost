import { describe, expect, it } from 'vitest';
import { experienceDesignTokens } from '../../src/ui/designTokens';

describe('experienceDesignTokens', () => {
  it('uses a clean local-app palette without the old gradient theme', () => {
    expect(experienceDesignTokens.color.background).toBe('#f6f7f8');
    expect(experienceDesignTokens.color.surface).toBe('#ffffff');
    expect(experienceDesignTokens.color.text).toBe('#18181b');
    expect(experienceDesignTokens.color.accent).toBe('#f2b705');
    expect(experienceDesignTokens.color.danger).toBe('#d92d20');
  });

  it('keeps compact desktop app geometry', () => {
    expect(experienceDesignTokens.radius.panel).toBe('8px');
    expect(experienceDesignTokens.radius.control).toBe('6px');
    expect(experienceDesignTokens.layout.sidebarWidth).toBe('148px');
  });

  it('defines typography for dense app chrome and content', () => {
    expect(experienceDesignTokens.typography.family).toContain('Plus Jakarta Sans');
    expect(experienceDesignTokens.typography.chromeSize).toBe('12px');
    expect(experienceDesignTokens.typography.titleSize).toBe('20px');
  });
});
