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
import {
  loadActiveLearningPlan,
  recordPlacementResult,
  saveLearningPlan,
} from './services/learningPlanService';
import toast from 'react-hot-toast';
import {
  createDefaultLocalProviderSettings,
  type LocalProviderSettings,
} from './src/domain/settings/providerSettings';
import { createLocalProviderRuntime } from './src/application/providerRuntime';
import { browserProviderSettingsRepository } from './src/infrastructure/browser/providerSettingsStorage';
import { browserProfileRepository } from './src/infrastructure/browser/profileStorage';
import { createInstalledNativeDeepgramFetch } from './src/infrastructure/native/deepgramFetch';

const LOCAL_LEARNER_ID = 'local-learner';

const MainApp: React.FC = () => {
  const [learningPlan, setLearningPlan] = useState<LearningPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [providerSettings, setProviderSettings] = useState<LocalProviderSettings>(
    createDefaultLocalProviderSettings
  );
  const [providerSettingsLoaded, setProviderSettingsLoaded] = useState(false);
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
      } finally {
        if (!cancelled) {
          setProviderSettingsLoaded(true);
        }
      }
    }

    loadProviderSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the active local learning plan at startup and when plan-facing routes are revisited.
  useEffect(() => {
    if (!location.pathname.match(/^\/(learning-plan|plan|)?$/)) return;

    let cancelled = false;

    const loadUserData = async () => {
      try {
        const { plan, error } = await loadActiveLearningPlan(LOCAL_LEARNER_ID);

        if (error) {
          console.error('Error loading learning plan:', error);
        } else if (!cancelled) {
          setLearningPlan(plan);
        }
      } catch (error) {
        console.error('Error loading local learning plan:', error);
      }
    };

    loadUserData();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const providerRuntimeDependencies = useMemo(() => ({
    fetchFn: createInstalledNativeDeepgramFetch() ?? undefined,
  }), []);
  const providerRuntime = useMemo(
    () => createLocalProviderRuntime(providerSettings, providerRuntimeDependencies),
    [providerRuntimeDependencies, providerSettings]
  );
  const runtimeAiProvider = providerRuntime.aiProvider ?? undefined;
  const runtimeSpeechProvider = providerRuntime.speechProvider ?? undefined;
  const runtimeLiveConversationProvider = providerRuntime.liveConversationProvider ?? undefined;

  const handleTestComplete = useCallback(
    async (result: TestResult) => {
      setLoadingPlan(true);

      try {
        const { result: savedPlacement, error: placementError } = await recordPlacementResult(
          LOCAL_LEARNER_ID,
          result
        );

        if (placementError) {
          throw placementError;
        }

        await browserProfileRepository.updateProfile(profile => ({
          ...profile,
          currentLevel: result.level,
        }));

        // Generate learning plan
        console.log('🤖 Generating learning plan with AI...');
        const plan = await generateLearningPlan(result, runtimeAiProvider);
        console.log('✅ AI generated plan:', plan);
        setLearningPlan(plan);

        console.log('💾 Saving learning plan locally...');
        const { error: planError, planId } = await saveLearningPlan(
          LOCAL_LEARNER_ID,
          plan,
          savedPlacement?.id
        );

        if (planError) {
          console.error('❌ Failed to save learning plan:', planError);
          throw new Error(`Failed to save plan: ${planError.message}`);
        }

        console.log('✅ Local learning plan saved with ID:', planId);
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
    [navigate, runtimeAiProvider]
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
          <Route
            path="/exam"
            element={
              <ExamSimulatorPage
                aiProvider={runtimeAiProvider}
                speechProvider={runtimeSpeechProvider}
                liveConversationProvider={runtimeLiveConversationProvider}
              />
            }
          />
          <Route
            path="/exam-simulator"
            element={
              <ExamSimulatorPage
                aiProvider={runtimeAiProvider}
                speechProvider={runtimeSpeechProvider}
                liveConversationProvider={runtimeLiveConversationProvider}
              />
            }
          />
          <Route
            path="/activity"
            element={
              <ActivityPage
                aiProvider={runtimeAiProvider}
                speechProvider={runtimeSpeechProvider}
                providerRuntimeReady={providerSettingsLoaded}
              />
            }
          />
          <Route
            path="/speaking-activity"
            element={
              <SpeakingActivityPage
                liveConversationProvider={runtimeLiveConversationProvider}
              />
            }
          />
          <Route
            path="/conversation"
            element={
              <SpeakingActivityPage
                liveConversationProvider={runtimeLiveConversationProvider}
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
