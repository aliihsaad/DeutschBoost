import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import ExperienceAppShell from './components/ExperienceAppShell';
import LocalDashboardPage from './pages/LocalDashboardPage';
import LocalSettingsPage from './pages/LocalSettingsPage';
import EnhancedPlacementTestPage from './pages/EnhancedPlacementTestPage';
import LearningPlanPage from './pages/LearningPlanPage';
import SpeakingActivityPage from './pages/SpeakingActivityPage';
import ProfilePage from './pages/ProfilePage';
import ActivityPage from './pages/ActivityPage';
import { PracticePage } from './pages/PracticePage';
import { ExamSimulatorPage } from './pages/ExamSimulatorPage';
import { TestResult, LearningPlan } from './types';
import { generateLearningPlan } from './services/geminiService';
import { loadActiveLearningPlan, saveLearningPlan } from './services/learningPlanService';
import { useAuth } from './src/contexts/AuthContext';
import { supabase } from './src/lib/supabase';
import toast from 'react-hot-toast';
import {
  createDefaultLocalProviderSettings,
  type LocalProviderSettings,
} from './src/domain/settings/providerSettings';
import { createLocalProviderRuntime } from './src/application/providerRuntime';
import { browserProviderSettingsRepository } from './src/infrastructure/browser/providerSettingsStorage';
import { browserProfileRepository } from './src/infrastructure/browser/profileStorage';

const MainApp: React.FC = () => {
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [providerSettings, setProviderSettings] = useState<LocalProviderSettings>(
    createDefaultLocalProviderSettings
  );
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function loadProviderSettings() {
      try {
        const loadedSettings = await browserProviderSettingsRepository.load();
        if (!cancelled) {
          setProviderSettings(loadedSettings);
        }
      } catch (error) {
        console.error('Error loading local provider settings:', error);
      }
    }

    loadProviderSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load user's level and active learning plan from database
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;

      try {
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
  }, [user]);

  // Reload learning plan when navigating to /learning-plan or / to reflect completed activities
  useEffect(() => {
    const reloadPlan = async () => {
      if (!user || !location.pathname.match(/^\/(learning-plan|)?$/)) return;

      try {
        const { plan, error } = await loadActiveLearningPlan(user.id);

        if (error) {
          console.error('Error reloading learning plan:', error);
        } else if (plan) {
          setLearningPlan(plan);
        }
      } catch (error) {
        console.error('Error reloading learning plan:', error);
      }
    };

    reloadPlan();
  }, [location.pathname, user]);

  const providerRuntime = useMemo(() => createLocalProviderRuntime(providerSettings), [providerSettings]);
  const runtimeAiProvider = providerRuntime.aiProvider ?? undefined;
  const runtimeSpeechProvider = providerRuntime.speechProvider ?? undefined;

  const handleTestComplete = useCallback(
    async (result: TestResult) => {
      if (!user) return;

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
        const plan = await generateLearningPlan(result, runtimeAiProvider);
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
        navigate('/learning-plan');
      } catch (error) {
        console.error('❌ Failed to generate/save learning plan:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Couldn't create your learning plan: ${errorMessage}. Check console for details.`);
      } finally {
        setLoadingPlan(false);
      }
    },
    [user, navigate, runtimeAiProvider]
  );

  // Removed handleTogglePlanItem - activities are now auto-completed when user finishes them

  return (
    <ExperienceAppShell providerSettings={providerRuntime.snapshots}>
        <Routes>
          <Route path="/" element={<LocalDashboardPage />} />
          <Route
            path="/placement-test"
            element={
              <EnhancedPlacementTestPage
                onTestComplete={handleTestComplete}
                aiProvider={runtimeAiProvider}
              />
            }
          />
          <Route path="/plan" element={<LearningPlanPage learningPlan={learningPlan} loading={loadingPlan} />} />
          <Route path="/learning-plan" element={<LearningPlanPage learningPlan={learningPlan} loading={loadingPlan} />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/exam" element={<ExamSimulatorPage />} />
          <Route path="/exam-simulator" element={<ExamSimulatorPage />} />
          <Route path="/activity" element={<ActivityPage aiProvider={runtimeAiProvider} />} />
          <Route
            path="/speaking-activity"
            element={
              <SpeakingActivityPage
                aiProvider={runtimeAiProvider}
                speechProvider={runtimeSpeechProvider}
              />
            }
          />
          <Route
            path="/conversation"
            element={
              <SpeakingActivityPage
                aiProvider={runtimeAiProvider}
                speechProvider={runtimeSpeechProvider}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <LocalSettingsPage
                repository={browserProviderSettingsRepository}
                onSettingsChange={setProviderSettings}
              />
            }
          />
          <Route path="/profile" element={<ProfilePage repository={browserProfileRepository} />} />
          <Route path="/review" element={<LocalWorkspacePlaceholderPage title="Review" description="Due vocabulary, phrases, grammar mistakes, and saved corrections will live here." />} />
          <Route path="/writing" element={<LocalWorkspacePlaceholderPage title="Writing" description="Prompts, drafts, AI feedback, and revision history will live here." />} />
          <Route path="/mistakes" element={<LocalWorkspacePlaceholderPage title="Mistakes" description="The searchable mistake notebook and review card workflow will live here." />} />
          <Route path="/library" element={<LocalWorkspacePlaceholderPage title="Library" description="Saved readings, listening items, grammar notes, and local content packs will live here." />} />
        </Routes>
    </ExperienceAppShell>
  );
};

const LocalWorkspacePlaceholderPage: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <main className="db-dashboard" aria-label={`${title} workspace`}>
    <section className="db-panel db-empty-workspace">
      <span className="db-section-label">Lokaler Arbeitsbereich</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  </main>
);

export default MainApp;
