import { supabase } from '../src/lib/supabase';
import { LearningPlan, LearningPlanItem, CEFRLevel } from '../types';

// Normalize skill name to match database constraint
const normalizeSkill = (skill: string): string => {
  const skillLower = skill.toLowerCase().trim();
  const skillMap: Record<string, string> = {
    'grammar': 'Grammar',
    'vocabulary': 'Vocabulary',
    'listening': 'Listening',
    'writing': 'Writing',
    'speaking': 'Speaking',
  };
  return skillMap[skillLower] || skill;
};

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
    console.log('💾 Starting saveLearningPlan for user:', userId);
    console.log('📋 Plan structure:', JSON.stringify(plan, null, 2));

    // 1. Deactivate any existing active plans for this user
    console.log('🔄 Deactivating old plans...');
    const { error: deactivateError } = await supabase
      .from('learning_plans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('❌ Error deactivating old plans:', deactivateError);
      return { error: deactivateError, planId: null };
    }
    console.log('✅ Old plans deactivated');

    // 2. Insert the new learning plan
    console.log('📝 Inserting learning plan...');
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
      console.error('❌ Error saving learning plan:', planError);
      return { error: planError, planId: null };
    }
    console.log('✅ Learning plan created with ID:', planData.id);

    // 3. Insert all learning plan items
    console.log('📦 Processing plan items...');
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
      console.error('❌ ERROR: Plan has no weeks! Plan structure:', plan);
      return { error: new Error('Plan has no weeks'), planId: null };
    }

    console.log(`📅 Processing ${plan.weeks.length} weeks...`);

    plan.weeks.forEach((week, weekIndex) => {
      console.log(`  Week ${week.week} (${week.focus}): ${week.items?.length || 0} items`);

      if (!week.items || week.items.length === 0) {
        console.warn(`  ⚠️ Week ${week.week} has no items - skipping`);
        return;
      }

      week.items.forEach((item, itemIndex) => {
        const normalizedSkill = normalizeSkill(item.skill);
        console.log(`    - Item ${itemIndex + 1}: ${item.topic} (${item.skill} → ${normalizedSkill})`);

        planItems.push({
          learning_plan_id: planData.id,
          week_number: week.week,
          week_focus: week.focus,
          topic: item.topic,
          skill: normalizedSkill as 'Grammar' | 'Vocabulary' | 'Listening' | 'Writing' | 'Speaking',
          description: item.description,
          completed: item.completed || false,
        });
      });
    });

    console.log(`📊 Total items to insert: ${planItems.length}`);

    if (planItems.length === 0) {
      console.error('❌ ERROR: No plan items to insert! All weeks were empty.');
      return { error: new Error('No plan items to insert - all weeks are empty'), planId: null };
    }

    console.log('💾 Inserting plan items...');
    console.log('Items to insert:', JSON.stringify(planItems, null, 2));

    const { error: itemsError } = await supabase
      .from('learning_plan_items')
      .insert(planItems);

    if (itemsError) {
      console.error('❌ Error saving learning plan items:', itemsError);
      console.error('Failed items:', planItems);
      return { error: itemsError, planId: null };
    }

    console.log('✅ Successfully saved all plan items!');
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

/**
 * Update user progress tracking
 * Updates total study time, study streak, and creates study session record
 */
export const updateUserProgress = async (
  userId: string,
  activityType: 'conversation' | 'flashcards' | 'listening' | 'reading' | 'writing' | 'grammar',
  durationSeconds: number,
  itemsCompleted: number = 1
): Promise<{ error: Error | null; profile?: any }> => {
  try {
    console.log('📊 Updating user progress:', { userId, activityType, durationSeconds, itemsCompleted });

    const durationMinutes = Math.round(durationSeconds / 60);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // 1. Get current user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('study_streak, total_study_time')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return { error: profileError };
    }

    const currentStreak = profile?.study_streak || 0;
    const currentTotalTime = profile?.total_study_time || 0;

    // 2. Check if user studied today
    const { data: todaySessions, error: todayError } = await supabase
      .from('study_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1);

    if (todayError) {
      console.error('Error checking today sessions:', todayError);
      return { error: todayError };
    }

    let newStreak = currentStreak;

    // If no session today, update streak
    if (!todaySessions || todaySessions.length === 0) {
      // Check yesterday's sessions to determine if streak continues
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toISOString().split('T')[0];

      const { data: yesterdaySessions, error: yesterdayError } = await supabase
        .from('study_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('date', yesterdayDate)
        .limit(1);

      if (yesterdayError) {
        console.error('Error checking yesterday sessions:', yesterdayError);
        return { error: yesterdayError };
      }

      // If studied yesterday, increment streak. Otherwise, reset to 1
      if (yesterdaySessions && yesterdaySessions.length > 0) {
        newStreak = currentStreak + 1;
        console.log('🔥 Streak continued! New streak:', newStreak);
      } else {
        newStreak = 1;
        console.log('🔥 Streak started/reset! New streak:', newStreak);
      }
    } else {
      console.log('✅ Already studied today, maintaining streak:', currentStreak);
    }

    // 3. Update user profile
    const newTotalTime = currentTotalTime + durationMinutes;
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        study_streak: newStreak,
        total_study_time: newTotalTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return { error: updateError };
    }

    console.log('✅ Profile updated:', { newStreak, newTotalTime });

    // 4. Create study session record
    const { error: sessionError } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        activity_type: activityType,
        duration_minutes: durationMinutes,
        items_completed: itemsCompleted,
        date: today,
      });

    if (sessionError) {
      console.error('Error creating study session:', sessionError);
      return { error: sessionError };
    }

    console.log('✅ Study session created');

    return {
      error: null,
      profile: {
        study_streak: newStreak,
        total_study_time: newTotalTime,
      },
    };
  } catch (err) {
    console.error('Unexpected error updating user progress:', err);
    return { error: err as Error };
  }
};
