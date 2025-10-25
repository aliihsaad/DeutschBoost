import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import EnhancedPlacementTestPage from './pages/EnhancedPlacementTestPage';
import LearningPlanPage from './pages/LearningPlanPage';
import ConversationPage from './pages/ConversationPage';
import ProfilePage from './pages/ProfilePage';
import ActivityPage from './pages/ActivityPage';
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
        console.log('🤖 Generating learning plan with AI...');
        const plan = await generateLearningPlan(result);
        console.log('✅ AI generated plan:', plan);
        setLearningPlan(plan);

        // Save learning plan to database using the service
        console.log('💾 Saving learning plan to database...');
        const { error: planError, planId } = await saveLearningPlan(user.id, plan, testResult.id);

        if (planError) {
          console.error('❌ Failed to save learning plan:', planError);
          throw new Error(`Failed to save plan: ${planError.message}`);
        }

        console.log('✅ Learning plan saved with ID:', planId);
        toast.success('Learning plan created successfully!');
        setCurrentPage(Page.LearningPlan);
        navigate('/learning-plan');
      } catch (error) {
        console.error('❌ Failed to generate/save learning plan:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Couldn't create your learning plan: ${errorMessage}. Check console for details.`);
      } finally {
        setLoadingPlan(false);
      }
    },
    [user, navigate]
  );

  // Removed handleTogglePlanItem - activities are now auto-completed when user finishes them

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPage={currentPage} setPage={setCurrentPage} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage setPage={setCurrentPage} learningPlan={learningPlan} userLevel={userLevel} />} />
          <Route path="/placement-test" element={<EnhancedPlacementTestPage onTestComplete={handleTestComplete} />} />
          <Route path="/learning-plan" element={<LearningPlanPage learningPlan={learningPlan} loading={loadingPlan} />} />
          <Route path="/activity" element={<ActivityPage />} />
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
