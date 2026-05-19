import { describe, expect, it } from 'vitest';
import { experienceDesignTokens } from '../../src/ui/designTokens';

describe('experienceDesignTokens', () => {
  it('exposes the unified learner-friendly palette', () => {
    expect(experienceDesignTokens.color.brand).toBe('#f2b705');
    expect(experienceDesignTokens.color.brandStrong).toBe('#b77900');
    expect(experienceDesignTokens.color.brandSoft).toBe('#fff4bf');
    expect(experienceDesignTokens.color.bg).toBe('#f6f7f8');
    expect(experienceDesignTokens.color.surface).toBe('#ffffff');
    expect(experienceDesignTokens.color.text).toBe('#18181b');
    expect(experienceDesignTokens.color.danger).toBe('#d92d20');
    expect(experienceDesignTokens.color.success).toBe('#16833a');
  });

  it('uses friendly geometry and readable type', () => {
    expect(experienceDesignTokens.radius.card).toBe('12px');
    expect(experienceDesignTokens.radius.control).toBe('8px');
    expect(experienceDesignTokens.type.title).toBe('24px');
    expect(experienceDesignTokens.type.body).toBe('14px');
  });

  it('defines a fixed accent per learning skill', () => {
    expect(Object.keys(experienceDesignTokens.skill)).toEqual([
      'grammar', 'vocabulary', 'listening', 'reading', 'writing', 'speaking',
    ]);
  });
});
