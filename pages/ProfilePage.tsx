import React, { useEffect, useMemo, useState } from 'react';
import {
  CEFR_LEVEL_OPTIONS,
  DAILY_GOAL_OPTIONS,
  LEARNING_FOCUS_OPTIONS,
  MOTHER_LANGUAGE_OPTIONS,
  REVIEW_INTENSITY_OPTIONS,
  TARGET_EXAM_OPTIONS,
  TUTOR_STYLE_OPTIONS,
  VOICE_PREFERENCE_OPTIONS,
  createDefaultLearnerProfile,
  type LearnerProfile,
  type ProfileOption,
  type ProfileRepository,
} from '../src/domain/profile/profileRepository';
import { browserProfileRepository } from '../src/infrastructure/browser/profileStorage';

interface ProfilePageProps {
  repository?: ProfileRepository;
  onProfileChange?: (profile: LearnerProfile) => void;
}

type SaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'reset' | 'error';
type SelectValue = string | number;

const ProfilePage: React.FC<ProfilePageProps> = ({
  repository = browserProfileRepository,
  onProfileChange,
}) => {
  const [profile, setProfile] = useState<LearnerProfile>(createDefaultLearnerProfile);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setSaveState('loading');
      setErrorMessage(null);

      try {
        const loaded = await repository.loadProfile();
        if (!cancelled) {
          setProfile(loaded);
          onProfileChange?.(loaded);
          setSaveState('idle');
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
          setSaveState('error');
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [onProfileChange, repository]);

  const summary = useMemo(() => {
    return {
      levelPath: `${profile.currentLevel} -> ${profile.targetLevel}`,
      nativeLanguage: findOptionLabel(MOTHER_LANGUAGE_OPTIONS, profile.motherLanguage),
      focus: findOptionLabel(LEARNING_FOCUS_OPTIONS, profile.learningFocus),
      exam: findOptionLabel(TARGET_EXAM_OPTIONS, profile.targetExam),
      dailyGoal: findOptionLabel(DAILY_GOAL_OPTIONS, profile.dailyGoalMinutes),
      tutorStyle: findOptionLabel(TUTOR_STYLE_OPTIONS, profile.tutorStyle),
    };
  }, [profile]);

  function updateProfileField<Key extends keyof LearnerProfile>(
    key: Key,
    value: LearnerProfile[Key]
  ) {
    setProfile(current => ({
      ...current,
      [key]: value,
    }));
    setSaveState('idle');
    setErrorMessage(null);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const saved = await repository.saveProfile(profile);
      setProfile(saved);
      onProfileChange?.(saved);
      setSaveState('saved');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSaveState('error');
    }
  }

  async function handleReset() {
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const resetProfile = await repository.resetProfile();
      setProfile(resetProfile);
      onProfileChange?.(resetProfile);
      setSaveState('reset');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSaveState('error');
    }
  }

  const busy = saveState === 'loading' || saveState === 'saving';

  return (
    <main className="db-dashboard db-profile" aria-label="Learner profile">
      <header className="db-dashboard-header">
        <div>
          <h1>Learner Profile</h1>
          <p>Your level, goals, voice, and study rhythm are saved on this device.</p>
        </div>
      </header>

      <form className="db-profile-grid" onSubmit={handleSave}>
        <section className="db-panel db-profile-summary-panel" aria-label="Profile summary">
          <span className="db-section-label">Local learner</span>
          <strong>{summary.levelPath}</strong>
          <dl>
            <div>
              <dt>Native language</dt>
              <dd>{summary.nativeLanguage}</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd>{summary.focus}</dd>
            </div>
            <div>
              <dt>Exam</dt>
              <dd>{summary.exam}</dd>
            </div>
            <div>
              <dt>Daily goal</dt>
              <dd>{summary.dailyGoal}</dd>
            </div>
          </dl>
        </section>

        <section className="db-panel db-profile-panel" aria-labelledby="profile-identity-heading">
          <div className="db-settings-section-heading">
            <h2 id="profile-identity-heading">Learning Identity</h2>
            <span>These choices guide German examples, explanations, and lesson difficulty.</span>
          </div>

          <div className="db-field-grid">
            <SelectField
              label="Current level"
              value={profile.currentLevel}
              options={CEFR_LEVEL_OPTIONS}
              onChange={value => updateProfileField('currentLevel', value)}
            />
            <SelectField
              label="Target level"
              value={profile.targetLevel}
              options={CEFR_LEVEL_OPTIONS}
              onChange={value => updateProfileField('targetLevel', value)}
            />
            <SelectField
              label="Native language"
              value={profile.motherLanguage}
              options={MOTHER_LANGUAGE_OPTIONS}
              onChange={value => updateProfileField('motherLanguage', value)}
            />
            <SelectField
              label="Learning focus"
              value={profile.learningFocus}
              options={LEARNING_FOCUS_OPTIONS}
              onChange={value => updateProfileField('learningFocus', value)}
            />
          </div>
        </section>

        <section className="db-panel db-profile-panel" aria-labelledby="profile-system-heading">
          <div className="db-settings-section-heading">
            <h2 id="profile-system-heading">Study System</h2>
            <span>Use fixed choices so the local app can tune plans without guessing from free text.</span>
          </div>

          <div className="db-field-grid">
            <SelectField
              label="Target exam"
              value={profile.targetExam}
              options={TARGET_EXAM_OPTIONS}
              onChange={value => updateProfileField('targetExam', value)}
            />
            <SelectField
              label="Daily goal"
              value={profile.dailyGoalMinutes}
              options={DAILY_GOAL_OPTIONS}
              onChange={value => updateProfileField('dailyGoalMinutes', value)}
            />
            <SelectField
              label="Review intensity"
              value={profile.reviewIntensity}
              options={REVIEW_INTENSITY_OPTIONS}
              onChange={value => updateProfileField('reviewIntensity', value)}
            />
            <SelectField
              label="Tutor style"
              value={profile.tutorStyle}
              options={TUTOR_STYLE_OPTIONS}
              onChange={value => updateProfileField('tutorStyle', value)}
            />
            <SelectField
              label="Voice preference"
              value={profile.voicePreference}
              options={VOICE_PREFERENCE_OPTIONS}
              onChange={value => updateProfileField('voicePreference', value)}
            />
            <div className="db-profile-facts" aria-label="Local progress snapshot">
              <span>Study streak</span>
              <strong>{profile.studyStreak} days</strong>
              <span>Total study time</span>
              <strong>{Math.round(profile.totalStudyTimeMinutes / 60)} hours</strong>
            </div>
          </div>
        </section>

        <section className="db-panel db-settings-save-panel" aria-label="Profile actions">
          <div>
            <span className="db-section-label">Personalization</span>
            <h2>{summary.tutorStyle}</h2>
            <p>Profile data stays in local storage and can be reset without touching provider keys.</p>
          </div>
          <div className="db-settings-actions">
            <button
              className="db-secondary-button"
              type="button"
              onClick={handleReset}
              disabled={busy}
            >
              Reset
            </button>
            <button className="db-primary-button" type="submit" disabled={busy}>
              {saveState === 'saving' ? 'Saving...' : 'Save profile'}
            </button>
          </div>
          <ProfileMessage state={saveState} errorMessage={errorMessage} />
        </section>
      </form>
    </main>
  );
};

interface SelectFieldProps<Value extends SelectValue> {
  label: string;
  value: Value;
  options: Array<ProfileOption<Value>>;
  onChange: (value: Value) => void;
}

const SelectField = <Value extends SelectValue>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<Value>) => (
  <label className="db-field">
    <span>{label}</span>
    <select
      value={String(value)}
      onChange={event => onChange(coerceSelectValue(event.target.value, options))}
    >
      {options.map(option => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const ProfileMessage: React.FC<{ state: SaveState; errorMessage: string | null }> = ({
  state,
  errorMessage,
}) => {
  if (state === 'saved') {
    return <p className="db-settings-message db-settings-message-success">Profile saved locally</p>;
  }

  if (state === 'reset') {
    return <p className="db-settings-message db-settings-message-success">Profile reset</p>;
  }

  if (state === 'error') {
    return (
      <p className="db-settings-message db-settings-message-error">
        {errorMessage ?? 'Profile could not be saved'}
      </p>
    );
  }

  return null;
};

function coerceSelectValue<Value extends SelectValue>(
  value: string,
  options: Array<ProfileOption<Value>>
): Value {
  const matched = options.find(option => String(option.value) === value);

  if (!matched) {
    return options[0].value;
  }

  return matched.value;
}

function findOptionLabel<Value extends SelectValue>(
  options: Array<ProfileOption<Value>>,
  value: Value
): string {
  return options.find(option => option.value === value)?.label ?? String(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Profile could not be saved';
}

export default ProfilePage;
