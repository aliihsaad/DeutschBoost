import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import PlacementTestPage from './pages/PlacementTestPage';
import LearningPlanPage from './pages/LearningPlanPage';
import ConversationPage from './pages/ConversationPage';
import ProfilePage from './pages/ProfilePage';
import { Page, CEFRLevel, TestResult, LearningPlan } from './types';
import { generateLearningPlan } from './services/geminiService';
import { useAuth } from './src/contexts/AuthContext';
import { supabase } from './src/lib/supabase';
import toast from 'react-hot-toast';

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [userLevel, setUserLevel] = useState<CEFRLevel>(CEFRLevel.A1);
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  // Load user's level and active learning plan from database
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;

      try {
        // Load user's current level
        if (userProfile?.current_level) {
          setUserLevel(userProfile.current_level as CEFRLevel);
        }

        // Load active learning plan
        const { data: activePlan, error } = await supabase
          .from('learning_plans')
          .select(`
            *,
            learning_plan_items (*)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw error;
        }

        if (activePlan) {
          // Transform database format to app format
          const weeks = new Map<number, any>();

          activePlan.learning_plan_items?.forEach((item: any) => {
            if (!weeks.has(item.week_number)) {
              weeks.set(item.week_number, {
                week: item.week_number,
                focus: item.week_focus,
                items: [],
              });
            }
            weeks.get(item.week_number)!.items.push({
              topic: item.topic,
              skill: item.skill,
              description: item.description,
              completed: item.completed,
            });
          });

          const transformedPlan: LearningPlan = {
            level: activePlan.target_level as CEFRLevel,
            goals: activePlan.goals,
            weeks: Array.from(weeks.values()).sort((a, b) => a.week - b.week),
          };

          setLearningPlan(transformedPlan);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [user, userProfile]);

  const handleTestComplete = useCallback(
    async (result: TestResult) => {
      if (!user) return;

      setUserLevel(result.level);
      setLoadingPlan(true);

      try {
        // Save test result to database
        const { data: testResult, error: testError } = await supabase
          .from('test_results')
          .insert({
            user_id: user.id,
            test_type: 'placement',
            level: result.level,
            sections: {},
            strengths: result.strengths,
            weaknesses: result.weaknesses,
            recommendations: result.recommendations,
          })
          .select()
          .single();

        if (testError) throw testError;

        // Update user's current level
        await supabase
          .from('user_profiles')
          .update({ current_level: result.level })
          .eq('id', user.id);

        // Generate learning plan
        const plan = await generateLearningPlan(result);
        setLearningPlan(plan);

        // Deactivate old learning plans
        await supabase
          .from('learning_plans')
          .update({ is_active: false })
          .eq('user_id', user.id);

        // Save new learning plan to database
        const { data: newPlan, error: planError } = await supabase
          .from('learning_plans')
          .insert({
            user_id: user.id,
            test_result_id: testResult.id,
            target_level: plan.level,
            goals: plan.goals,
            duration_weeks: plan.weeks.length,
            is_active: true,
          })
          .select()
          .single();

        if (planError) throw planError;

        // Save learning plan items
        const planItems = plan.weeks.flatMap((week) =>
          week.items.map((item) => ({
            learning_plan_id: newPlan.id,
            week_number: week.week,
            week_focus: week.focus,
            topic: item.topic,
            skill: item.skill,
            description: item.description,
            completed: false,
          }))
        );

        const { error: itemsError } = await supabase
          .from('learning_plan_items')
          .insert(planItems);

        if (itemsError) throw itemsError;

        toast.success('Learning plan created successfully!');
        setCurrentPage(Page.LearningPlan);
        navigate('/learning-plan');
      } catch (error) {
        console.error('Failed to generate learning plan', error);
        toast.error("We couldn't generate your learning plan. Please try again.");
      } finally {
        setLoadingPlan(false);
      }
    },
    [user, navigate]
  );

  const handleTogglePlanItem = async (weekIndex: number, itemIndex: number) => {
    if (!user || !learningPlan) return;

    const newPlan = JSON.parse(JSON.stringify(learningPlan)); // Deep copy
    const item = newPlan.weeks[weekIndex].items[itemIndex];
    item.completed = !item.completed;
    setLearningPlan(newPlan);

    try {
      // Get the active learning plan ID
      const { data: activePlan } = await supabase
        .from('learning_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!activePlan) return;

      // Find and update the specific item
      const weekNumber = newPlan.weeks[weekIndex].week;
      const topic = item.topic;

      const { error } = await supabase
        .from('learning_plan_items')
        .update({
          completed: item.completed,
          completed_at: item.completed ? new Date().toISOString() : null,
        })
        .eq('learning_plan_id', activePlan.id)
        .eq('week_number', weekNumber)
        .eq('topic', topic);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating plan item:', error);
      toast.error('Failed to update progress');
      // Revert the change
      item.completed = !item.completed;
      setLearningPlan(learningPlan);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPage={currentPage} setPage={setCurrentPage} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage setPage={setCurrentPage} learningPlan={learningPlan} userLevel={userLevel} />} />
          <Route path="/placement-test" element={<PlacementTestPage onTestComplete={handleTestComplete} />} />
          <Route path="/learning-plan" element={<LearningPlanPage learningPlan={learningPlan} loading={loadingPlan} onToggleItem={handleTogglePlanItem} />} />
          <Route path="/conversation" element={<ConversationPage />} />
          <Route path="/profile" element={<ProfilePage userLevel={userLevel} />} />
        </Routes>
      </main>
      <footer className="bg-slate-800 text-white text-center p-4">
        <p>&copy; 2024 DeutschBoost. Learn German smarter with AI.</p>
      </footer>
    </div>
  );
};

export default MainApp;
