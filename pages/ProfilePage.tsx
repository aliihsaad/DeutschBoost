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
import { Badge, Button, Card, Field, PageHeader, Stat } from '../components/ui';

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
    <main className="mx-auto w-full max-w-6xl px-6 py-8" aria-label="Learner profile">
      <PageHeader
        title="Learner Profile"
        subtitle="Your level, goals, voice, and study rhythm are saved on this device."
      />

      <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-3">
        <Card aria-label="Profile summary" className="md:col-span-1">
          <Badge tone="brand">Local learner</Badge>
          <p className="mt-3 text-[30px] font-extrabold leading-none text-text">{summary.levelPath}</p>
          <dl className="mt-4 grid gap-3">
            <SummaryRow label="Native language" value={summary.nativeLanguage} />
            <SummaryRow label="Focus" value={summary.focus} />
            <SummaryRow label="Exam" value={summary.exam} />
            <SummaryRow label="Daily goal" value={summary.dailyGoal} />
          </dl>
        </Card>

        <Card title="Learning Identity" className="md:col-span-2">
          <p className="mb-4 text-[12px] text-text-muted">
            These choices guide German examples, explanations, and lesson difficulty.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
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
        </Card>

        <Card title="Study System" className="md:col-span-3">
          <p className="mb-4 text-[12px] text-text-muted">
            Use fixed choices so the local app can tune plans without guessing from free text.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
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
            <div className="grid gap-3" aria-label="Local progress snapshot">
              <Stat label="Study streak" value={`${profile.studyStreak} days`} />
              <Stat label="Total study time" value={`${Math.round(profile.totalStudyTimeMinutes / 60)} hours`} />
            </div>
          </div>
        </Card>

        <Card aria-label="Profile actions" className="md:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge tone="neutral">Personalization</Badge>
              <h2 className="mt-2 text-[16px] font-semibold text-text">{summary.tutorStyle}</h2>
              <p className="mt-1 max-w-2xl text-[12px] text-text-muted">
                Profile data stays in local storage and can be reset without touching provider keys.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" type="button" onClick={handleReset} disabled={busy}>
                Reset
              </Button>
              <Button type="submit" disabled={busy}>
                {saveState === 'saving' ? 'Saving...' : 'Save profile'}
              </Button>
            </div>
          </div>
          <ProfileMessage state={saveState} errorMessage={errorMessage} />
        </Card>
      </form>
    </main>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
    <dt className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{label}</dt>
    <dd className="m-0 text-[13px] font-bold text-text">{value}</dd>
  </div>
);

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
}: SelectFieldProps<Value>) => {
  const selectId = React.useId();

  return (
    <Field label={label} htmlFor={selectId}>
      <select
        id={selectId}
        value={String(value)}
        onChange={event => onChange(coerceSelectValue(event.target.value, options))}
        className="w-full rounded-control border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-brand focus:outline-none"
      >
        {options.map(option => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
};

const ProfileMessage: React.FC<{ state: SaveState; errorMessage: string | null }> = ({
  state,
  errorMessage,
}) => {
  if (state === 'saved') {
    return <p className="mt-3 text-[12px] font-semibold text-success">Profile saved locally</p>;
  }

  if (state === 'reset') {
    return <p className="mt-3 text-[12px] font-semibold text-success">Profile reset</p>;
  }

  if (state === 'error') {
    return (
      <p className="mt-3 text-[12px] font-semibold text-danger">
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
