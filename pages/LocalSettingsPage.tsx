import React, { useEffect, useMemo, useState } from 'react';
import {
  DEEPGRAM_LANGUAGE_OPTIONS,
  DEEPGRAM_MODEL_OPTIONS,
  OPENROUTER_MODEL_OPTIONS,
  buildProviderSettingsSnapshots,
  createDefaultLocalProviderSettings,
  type ProviderModelOption,
  type LocalProviderSettings,
} from '../src/domain/settings/providerSettings';
import type { ProviderSettingsRepository } from '../src/domain/settings/providerSettingsRepository';
import {
  createDeepgramSpeechProvider,
  testDeepgramApiKey,
  type DeepgramApiKeyTestResult,
} from '../src/domain/speech/deepgramProvider';
import type { SpeechTranscriptionResult } from '../src/domain/speech/speechProvider';
import { recordAudioSample, type RecordedAudioSample } from '../src/infrastructure/browser/audioRecorder';
import { browserProviderSettingsRepository } from '../src/infrastructure/browser/providerSettingsStorage';
import { createInstalledNativeDeepgramFetch } from '../src/infrastructure/native/deepgramFetch';
import { describeProviderStatus, type ProviderSettingsSnapshot } from '../src/ui/providerStatusModel';

type DeepgramApiKeyTester = (apiKey: string) => Promise<DeepgramApiKeyTestResult>;
type DeepgramAudioRecorder = () => Promise<RecordedAudioSample>;
type DeepgramAudioTester = (request: DeepgramAudioTestRequest) => Promise<SpeechTranscriptionResult>;

interface DeepgramAudioTestRequest {
  apiKey: string;
  model: string;
  language: string;
  audio: Blob;
  mimeType: string;
}

interface LocalSettingsPageProps {
  repository?: ProviderSettingsRepository;
  onSettingsChange?: (settings: LocalProviderSettings) => void;
  deepgramApiKeyTester?: DeepgramApiKeyTester;
  deepgramAudioRecorder?: DeepgramAudioRecorder;
  deepgramAudioTester?: DeepgramAudioTester;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'reset' | 'error';
type ConnectionTestState = 'idle' | 'testing' | 'success' | 'error';

const defaultDeepgramApiKeyTester: DeepgramApiKeyTester = apiKey =>
  testDeepgramApiKey({
    apiKey,
    fetchFn: createInstalledNativeDeepgramFetch() ?? undefined,
  });

const defaultDeepgramAudioRecorder: DeepgramAudioRecorder = () => recordAudioSample();

const defaultDeepgramAudioTester: DeepgramAudioTester = request =>
  createDeepgramSpeechProvider({
    apiKey: request.apiKey,
    model: request.model,
    language: request.language,
    fetchFn: createInstalledNativeDeepgramFetch() ?? undefined,
  }).transcribe({
    feature: 'settings-deepgram-test',
    audio: request.audio,
    mimeType: request.mimeType,
    options: {
      model: request.model,
      language: request.language,
      punctuation: true,
    },
  });

const LocalSettingsPage: React.FC<LocalSettingsPageProps> = ({
  repository = browserProviderSettingsRepository,
  onSettingsChange,
  deepgramApiKeyTester = defaultDeepgramApiKeyTester,
  deepgramAudioRecorder = defaultDeepgramAudioRecorder,
  deepgramAudioTester = defaultDeepgramAudioTester,
}) => {
  const [settings, setSettings] = useState<LocalProviderSettings>(createDefaultLocalProviderSettings);
  const [apiKeyDrafts, setApiKeyDrafts] = useState({ ai: '', speech: '' });
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [deepgramTest, setDeepgramTest] = useState<{
    state: ConnectionTestState;
    message: string | null;
  }>({ state: 'idle', message: null });
  const [deepgramAudioTest, setDeepgramAudioTest] = useState<{
    state: ConnectionTestState;
    message: string | null;
  }>({ state: 'idle', message: null });
  const [samplePlaybackUrl, setSamplePlaybackUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const loaded = await repository.load();
        if (!cancelled) {
          setSettings(loaded);
          setApiKeyDrafts({ ai: '', speech: '' });
          resetDeepgramTestState();
          onSettingsChange?.(loaded);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
          setSaveState('error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [onSettingsChange, repository]);

  useEffect(() => {
    return () => {
      releasePlaybackUrl(samplePlaybackUrl);
    };
  }, [samplePlaybackUrl]);

  const snapshots = useMemo(() => buildProviderSettingsSnapshots(settings), [settings]);
  const aiStatus = describeProviderStatus(snapshots.ai);
  const speechStatus = describeProviderStatus(snapshots.speech);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const settingsToSave = mergeApiKeyDrafts(settings, apiKeyDrafts);
      const saved = await repository.save(settingsToSave);
      setSettings(saved);
      setApiKeyDrafts({ ai: '', speech: '' });
      onSettingsChange?.(saved);
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
      const resetSettings = await repository.reset();
      setSettings(resetSettings);
      setApiKeyDrafts({ ai: '', speech: '' });
      resetDeepgramTestState();
      onSettingsChange?.(resetSettings);
      setSaveState('reset');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSaveState('error');
    }
  }

  function resetDeepgramTestState() {
    setDeepgramTest({ state: 'idle', message: null });
    setDeepgramAudioTest({ state: 'idle', message: null });
    setSamplePlaybackUrl(current => {
      releasePlaybackUrl(current);
      return null;
    });
  }

  async function handleTestDeepgram() {
    const apiKey = selectSecret(apiKeyDrafts.speech, settings.speech.apiKey);

    if (!apiKey) {
      setDeepgramTest({
        state: 'error',
        message: 'Add a Deepgram API key first',
      });
      return;
    }

    setDeepgramTest({ state: 'testing', message: null });

    try {
      const result = await deepgramApiKeyTester(apiKey);
      setDeepgramTest({
        state: result.ok ? 'success' : 'error',
        message: result.message,
      });
    } catch (error) {
      setDeepgramTest({
        state: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  async function handleRecordDeepgramAudio() {
    const apiKey = selectSecret(apiKeyDrafts.speech, settings.speech.apiKey);

    if (!apiKey) {
      setDeepgramAudioTest({
        state: 'error',
        message: 'Add a Deepgram API key first',
      });
      return;
    }

    setDeepgramAudioTest({ state: 'testing', message: null });

    try {
      const sample = await deepgramAudioRecorder();
      setSamplePlaybackUrl(current => {
        releasePlaybackUrl(current);
        return sample.playbackUrl ?? null;
      });

      const result = await deepgramAudioTester({
        apiKey,
        model: settings.speech.model,
        language: settings.speech.language,
        audio: sample.audio,
        mimeType: sample.mimeType,
      });
      const transcriptText = result.transcript.text || result.rawText;
      setDeepgramAudioTest({
        state: 'success',
        message: `Transcript: ${transcriptText}`,
      });
    } catch (error) {
      setDeepgramAudioTest({
        state: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <main className="db-dashboard db-settings" aria-label="Local settings">
      <header className="db-dashboard-header">
        <div>
          <h1>Local Settings</h1>
          <p>Provider keys, models, files, and privacy stay on this device.</p>
        </div>
      </header>

      <form className="db-settings-grid" onSubmit={handleSave}>
        <section className="db-panel db-settings-panel" aria-labelledby="ai-provider-heading">
          <ProviderPanelHeader snapshot={snapshots.ai} />
          <div className="db-settings-section-heading">
            <h2 id="ai-provider-heading">AI Provider</h2>
            <span>{aiStatus.detail}</span>
          </div>

          <label className="db-toggle-row">
            <input
              type="checkbox"
              checked={settings.ai.enabled}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  ai: { ...current.ai, enabled: event.target.checked },
                }))
              }
            />
            <span>Enable OpenRouter</span>
          </label>

          <div className="db-field-grid">
            <SecretField
              label="OpenRouter API key"
              value={apiKeyDrafts.ai}
              saved={hasSecret(settings.ai.apiKey)}
              onChange={value =>
                setApiKeyDrafts(current => ({
                  ...current,
                  ai: value,
                }))
              }
            />
            <SelectField
              label="OpenRouter model"
              value={settings.ai.model}
              options={OPENROUTER_MODEL_OPTIONS}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  ai: { ...current.ai, model: value },
                }))
              }
            />
          </div>
        </section>

        <section className="db-panel db-settings-panel" aria-labelledby="speech-provider-heading">
          <ProviderPanelHeader snapshot={snapshots.speech} />
          <div className="db-settings-section-heading">
            <h2 id="speech-provider-heading">Speech Provider</h2>
            <span>{speechStatus.detail}</span>
          </div>

          <label className="db-toggle-row">
            <input
              type="checkbox"
              checked={settings.speech.enabled}
              onChange={event =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, enabled: event.target.checked },
                }))
              }
            />
            <span>Enable Deepgram</span>
          </label>

          <div className="db-field-grid">
            <SecretField
              label="Deepgram API key"
              value={apiKeyDrafts.speech}
              saved={hasSecret(settings.speech.apiKey)}
              onChange={value => {
                resetDeepgramTestState();
                setApiKeyDrafts(current => ({
                  ...current,
                  speech: value,
                }));
              }}
            />
            <div className="db-provider-test-row">
              <button
                className="db-inline-button"
                type="button"
                onClick={handleTestDeepgram}
                disabled={loading || deepgramTest.state === 'testing'}
              >
                {deepgramTest.state === 'testing' ? 'Testing...' : 'Test key'}
              </button>
              <button
                className="db-inline-button"
                type="button"
                onClick={handleRecordDeepgramAudio}
                disabled={loading || deepgramAudioTest.state === 'testing'}
              >
                {deepgramAudioTest.state === 'testing' ? 'Recording...' : 'Record test audio'}
              </button>
              <ProviderTestMessage state={deepgramTest.state} message={deepgramTest.message} />
            </div>
            {samplePlaybackUrl ? (
              <audio
                className="db-provider-test-audio"
                controls
                src={samplePlaybackUrl}
                aria-label="Deepgram test sample playback"
              />
            ) : null}
            <ProviderTestMessage state={deepgramAudioTest.state} message={deepgramAudioTest.message} />
            <SelectField
              label="Deepgram model"
              value={settings.speech.model}
              options={DEEPGRAM_MODEL_OPTIONS}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, model: value },
                }))
              }
            />
            <SelectField
              label="Deepgram language"
              value={settings.speech.language}
              options={DEEPGRAM_LANGUAGE_OPTIONS}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, language: value },
                }))
              }
            />
          </div>
        </section>

        <section className="db-panel db-settings-save-panel" aria-label="Settings actions">
          <div>
            <span className="db-section-label">Local storage</span>
            <h2>Device only</h2>
            <p>OpenRouter and Deepgram keys stay on this device.</p>
          </div>
          <div className="db-settings-actions">
            <button
              className="db-secondary-button"
              type="button"
              onClick={handleReset}
              disabled={loading || saveState === 'saving'}
            >
              Reset
            </button>
            <button className="db-primary-button" type="submit" disabled={loading || saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving...' : 'Save settings'}
            </button>
          </div>
          <SettingsMessage state={saveState} errorMessage={errorMessage} />
        </section>
      </form>
    </main>
  );
};

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface SecretFieldProps extends TextFieldProps {
  saved: boolean;
}

const SecretField: React.FC<SecretFieldProps> = ({ label, value, saved, onChange }) => (
  <SecretFieldBody label={label} value={value} saved={saved} onChange={onChange} />
);

const SecretFieldBody: React.FC<SecretFieldProps> = ({ label, value, saved, onChange }) => {
  const inputId = React.useId();
  const hintId = React.useId();

  return (
    <div className="db-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="password"
        value={value}
        autoComplete="off"
        aria-describedby={saved && value.length === 0 ? hintId : undefined}
        placeholder={saved ? 'Paste a new key to replace saved key' : 'Paste API key'}
        onChange={event => onChange(event.target.value)}
      />
      {saved && value.length === 0 ? <em id={hintId}>Saved key hidden</em> : null}
    </div>
  );
};

interface SelectFieldProps extends TextFieldProps {
  options: ProviderModelOption[];
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, options, onChange }) => (
  <label className="db-field">
    <span>{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const ProviderPanelHeader: React.FC<{ snapshot: ProviderSettingsSnapshot }> = ({ snapshot }) => {
  const status = describeProviderStatus(snapshot);

  return (
    <div className="db-provider-card-heading">
      <span className={`db-provider-state db-provider-state-${status.state}`}>
        {formatProviderHeadline(snapshot)}
      </span>
      <span>{snapshot.model}</span>
    </div>
  );
};

const SettingsMessage: React.FC<{ state: SaveState; errorMessage: string | null }> = ({ state, errorMessage }) => {
  if (state === 'saved') {
    return <p className="db-settings-message db-settings-message-success">Settings saved locally</p>;
  }

  if (state === 'reset') {
    return <p className="db-settings-message db-settings-message-success">Settings reset</p>;
  }

  if (state === 'error') {
    return (
      <p className="db-settings-message db-settings-message-error">
        {errorMessage ?? 'Settings could not be saved'}
      </p>
    );
  }

  return null;
};

const ProviderTestMessage: React.FC<{ state: ConnectionTestState; message: string | null }> = ({
  state,
  message,
}) => {
  if (!message) {
    return null;
  }

  return <p className={`db-provider-test-message db-provider-test-message-${state}`}>{message}</p>;
};

function formatProviderHeadline(snapshot: ProviderSettingsSnapshot): string {
  const status = describeProviderStatus(snapshot);

  if (status.state === 'disabled') {
    return snapshot.kind === 'ai'
      ? `${snapshot.providerName} AI is off`
      : `${snapshot.providerName} voice is off`;
  }

  return status.headline;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Settings could not be saved';
}

function mergeApiKeyDrafts(
  settings: LocalProviderSettings,
  apiKeyDrafts: { ai: string; speech: string }
): LocalProviderSettings {
  return {
    ai: {
      ...settings.ai,
      ...optionalSecret('apiKey', apiKeyDrafts.ai, settings.ai.apiKey),
    },
    speech: {
      ...settings.speech,
      ...optionalSecret('apiKey', apiKeyDrafts.speech, settings.speech.apiKey),
    },
  };
}

function optionalSecret<Key extends string>(
  key: Key,
  draft: string,
  existing?: string
): Partial<Record<Key, string>> {
  const nextValue = draft.trim() || existing?.trim();
  return nextValue ? ({ [key]: nextValue } as Partial<Record<Key, string>>) : {};
}

function selectSecret(draft: string, existing?: string): string | undefined {
  return draft.trim() || existing?.trim();
}

function hasSecret(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function releasePlaybackUrl(url: string | null | undefined): void {
  if (url && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

export default LocalSettingsPage;
