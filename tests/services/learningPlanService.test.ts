import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CEFRLevel } from '../../types';

// Mock Supabase
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: 'plan-123' },
            error: null,
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: {
                    id: 'plan-123',
                    target_level: 'B1',
                    goals: ['Learn grammar', 'Improve vocabulary'],
                  },
                  error: null,
                })),
              })),
            })),
          })),
          order: vi.fn(() => Promise.resolve({
            data: [
              {
                id: 'item-1',
                week_number: 1,
                week_focus: 'Grammar basics',
                topic: 'Articles',
                skill: 'Grammar',
                description: 'Learn German articles',
                completed: false,
              },
            ],
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('learningPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveLearningPlan', () => {
    it('should validate plan has weeks', async () => {
      const { saveLearningPlan } = await import('../../services/learningPlanService');

      const emptyPlan = {
        level: CEFRLevel.A2,
        goals: ['Test goal'],
        weeks: [],
      };

      const result = await saveLearningPlan('user-123', emptyPlan);
      expect(result.error).toBeTruthy();
      expect(result.error?.message).toContain('no weeks');
    });

    it('should validate plan has items in weeks', async () => {
      const { saveLearningPlan } = await import('../../services/learningPlanService');

      const emptyWeeksPlan = {
        level: CEFRLevel.A2,
        goals: ['Test goal'],
        weeks: [
          { week: 1, focus: 'Test', items: [] },
        ],
      };

      const result = await saveLearningPlan('user-123', emptyWeeksPlan);
      expect(result.error).toBeTruthy();
      expect(result.error?.message).toContain('empty');
    });

    it('should normalize skill names', async () => {
      const { saveLearningPlan } = await import('../../services/learningPlanService');

      const plan = {
        level: CEFRLevel.B1,
        goals: ['Learn'],
        weeks: [
          {
            week: 1,
            focus: 'Grammar',
            items: [
              { topic: 'Test', skill: 'grammar', description: 'Test desc', completed: false },
            ],
          },
        ],
      };

      const result = await saveLearningPlan('user-123', plan);
      // Should not error due to lowercase skill
      expect(result.planId).toBe('plan-123');
    });
  });

  describe('loadActiveLearningPlan', () => {
    it('should return null when no active plan exists', async () => {
      const { supabase } = await import('../../src/lib/supabase');

      // Override mock for this test
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'No rows' },
                  }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      const { loadActiveLearningPlan } = await import('../../services/learningPlanService');
      const result = await loadActiveLearningPlan('user-123');

      expect(result.plan).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('updatePlanItemCompletion', () => {
    it('should update item completion status', async () => {
      const { updatePlanItemCompletion } = await import('../../services/learningPlanService');

      const result = await updatePlanItemCompletion('user-123', 'item-1', true);
      expect(result.error).toBeNull();
    });
  });
});
