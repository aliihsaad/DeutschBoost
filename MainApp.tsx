import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import EnhancedPlacementTestPage from './pages/EnhancedPlacementTestPage';
import LearningPlanPage from './pages/LearningPlanPage';
import ConversationPage from './pages/ConversationPage';
import ProfilePage from './pages/ProfilePage';
import { Page, CEFRLevel, TestResult, LearningPlan } from './types';
import { generateLearningPlan } from './services/geminiService';
import { loadActiveLearningPlan, saveLearningPlan, updatePlanItemCompletion } from './services/learningPlanService';
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

        // Load active learning plan using the service
        const { plan, error } = await loadActiveLearningPlan(user.id);

        if (error) {
          console.error('Error loading learning plan:', error);
        } else if (plan) {
          setLearningPlan(plan);
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

        // Save learning plan to database using the service
        const { error: planError } = await saveLearningPlan(user.id, plan, testResult.id);

        if (planError) throw planError;

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
    const newCompletedStatus = !item.completed;
    item.completed = newCompletedStatus;
    setLearningPlan(newPlan);

    try {
      // Update using the service
      const weekNumber = newPlan.weeks[weekIndex].week;
      const { error } = await updatePlanItemCompletion(user.id, weekNumber, itemIndex, newCompletedStatus);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating plan item:', error);
      toast.error('Failed to update progress');
      // Revert the change
      item.completed = !newCompletedStatus;
      setLearningPlan(learningPlan);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPage={currentPage} setPage={setCurrentPage} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage setPage={setCurrentPage} learningPlan={learningPlan} userLevel={userLevel} />} />
          <Route path="/placement-test" element={<EnhancedPlacementTestPage onTestComplete={handleTestComplete} />} />
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
