import { supabase } from '../src/lib/supabase';
import { LearningPlan, LearningPlanItem, CEFRLevel } from '../types';

/**
 * Save a learning plan to the database
 * Creates entries in both learning_plans and learning_plan_items tables
 */
export const saveLearningPlan = async (
  userId: string,
  plan: LearningPlan,
  testResultId?: string
): Promise<{ error: Error | null; planId: string | null }> => {
  try {
    // 1. Deactivate any existing active plans for this user
    const { error: deactivateError } = await supabase
      .from('learning_plans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('Error deactivating old plans:', deactivateError);
      return { error: deactivateError, planId: null };
    }

    // 2. Insert the new learning plan
    const { data: planData, error: planError } = await supabase
      .from('learning_plans')
      .insert({
        user_id: userId,
        test_result_id: testResultId || null,
        target_level: plan.level as CEFRLevel,
        goals: plan.goals,
        duration_weeks: plan.weeks?.length || 0,
        is_active: true,
      })
      .select()
      .single();

    if (planError || !planData) {
      console.error('Error saving learning plan:', planError);
      return { error: planError, planId: null };
    }

    // 3. Insert all learning plan items
    const planItems: Array<{
      learning_plan_id: string;
      week_number: number;
      week_focus: string;
      topic: string;
      skill: 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking';
      description: string;
      completed: boolean;
    }> = [];

    if (!plan.weeks || plan.weeks.length === 0) {
      console.error('ERROR: Plan has no weeks! Plan structure:', plan);
      return { error: new Error('Plan has no weeks'), planId: null };
    }

    plan.weeks.forEach((week) => {
      if (!week.items || week.items.length === 0) {
        return;
      }

      week.items.forEach((item) => {
        planItems.push({
          learning_plan_id: planData.id,
          week_number: week.week,
          week_focus: week.focus,
          topic: item.topic,
          skill: item.skill,
          description: item.description,
          completed: item.completed || false,
        });
      });
    });

    if (planItems.length === 0) {
      console.error('ERROR: No plan items to insert!');
      return { error: new Error('No plan items to insert'), planId: null };
    }

    const { error: itemsError } = await supabase
      .from('learning_plan_items')
      .insert(planItems);

    if (itemsError) {
      console.error('Error saving learning plan items:', itemsError);
      return { error: itemsError, planId: null };
    }

    return { error: null, planId: planData.id };
  } catch (err) {
    console.error('Unexpected error saving learning plan:', err);
    return { error: err as Error, planId: null };
  }
};

/**
 * Load the active learning plan for a user
 * Returns the plan in the same format as the AI generates it
 */
export const loadActiveLearningPlan = async (
  userId: string
): Promise<{ plan: LearningPlan | null; error: Error | null }> => {
  try {
    // 1. Get the active learning plan
    const { data: planData, error: planError } = await supabase
      .from('learning_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (planError) {
      if (planError.code === 'PGRST116') {
        // No rows returned - user doesn't have an active plan
        return { plan: null, error: null };
      }
      console.error('Error loading learning plan:', planError);
      return { plan: null, error: planError };
    }

    if (!planData) {
      return { plan: null, error: null };
    }

    // 2. Get all items for this plan
    const { data: itemsData, error: itemsError } = await supabase
      .from('learning_plan_items')
      .select('*')
      .eq('learning_plan_id', planData.id)
      .order('week_number', { ascending: true });

    if (itemsError) {
      console.error('Error loading learning plan items:', itemsError);
      return { plan: null, error: itemsError };
    }

    // 3. Transform database data into LearningPlan format
    const weekMap = new Map<number, {
      week: number;
      focus: string;
      items: LearningPlanItem[];
    }>();

    itemsData.forEach((item) => {
      if (!weekMap.has(item.week_number)) {
        weekMap.set(item.week_number, {
          week: item.week_number,
          focus: item.week_focus,
          items: [],
        });
      }

      weekMap.get(item.week_number)!.items.push({
        topic: item.topic,
        skill: item.skill,
        description: item.description,
        completed: item.completed,
      });
    });

    const weeks = Array.from(weekMap.values()).sort((a, b) => a.week - b.week);

    const learningPlan: LearningPlan = {
      level: planData.target_level as CEFRLevel,
      goals: planData.goals,
      weeks,
    };

    return { plan: learningPlan, error: null };
  } catch (err) {
    console.error('Unexpected error loading learning plan:', err);
    return { plan: null, error: err as Error };
  }
};

/**
 * Update the completion status of a learning plan item
 */
export const updatePlanItemCompletion = async (
  userId: string,
  weekNumber: number,
  itemIndex: number,
  completed: boolean
): Promise<{ error: Error | null }> => {
  try {
    // 1. Get the active learning plan
    const { data: planData, error: planError } = await supabase
      .from('learning_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (planError || !planData) {
      console.error('Error finding active plan:', planError);
      return { error: planError || new Error('No active plan found') };
    }

    // 2. Get the specific item to update
    const { data: items, error: itemsError } = await supabase
      .from('learning_plan_items')
      .select('id')
      .eq('learning_plan_id', planData.id)
      .eq('week_number', weekNumber)
      .order('id', { ascending: true });

    if (itemsError || !items || items.length <= itemIndex) {
      console.error('Error finding plan item:', itemsError);
      return { error: itemsError || new Error('Plan item not found') };
    }

    const itemToUpdate = items[itemIndex];

    // 3. Update the item
    const { error: updateError } = await supabase
      .from('learning_plan_items')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', itemToUpdate.id);

    if (updateError) {
      console.error('Error updating plan item:', updateError);
      return { error: updateError };
    }

    return { error: null };
  } catch (err) {
    console.error('Unexpected error updating plan item:', err);
    return { error: err as Error };
  }
};
