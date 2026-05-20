import React, { useEffect, useMemo, useState } from 'react';
import {
  DEEPGRAM_LANGUAGE_OPTIONS,
  DEEPGRAM_MODEL_OPTIONS,
  DEEPGRAM_TTS_MODEL_OPTIONS,
  GEMINI_LIVE_MODEL_OPTIONS,
  GEMINI_LIVE_VOICE_OPTIONS,
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
import type {
  SpeechSynthesisResult,
  SpeechTranscriptionResult,
} from '../src/domain/speech/speechProvider';
import { recordAudioSample, type RecordedAudioSample } from '../src/infrastructure/browser/audioRecorder';
import { browserProviderSettingsRepository } from '../src/infrastructure/browser/providerSettingsStorage';
import { createInstalledNativeDeepgramFetch } from '../src/infrastructure/native/deepgramFetch';
import { describeProviderStatus, type ProviderSettingsSnapshot } from '../src/ui/providerStatusModel';
import { Badge, Button, Card, Field, PageHeader, cn } from '../components/ui';

type DeepgramApiKeyTester = (apiKey: string) => Promise<DeepgramApiKeyTestResult>;
type DeepgramAudioRecorder = () => Promise<RecordedAudioSample>;
type DeepgramAudioTester = (request: DeepgramAudioTestRequest) => Promise<SpeechTranscriptionResult>;
type DeepgramTtsTester = (request: DeepgramTtsTestRequest) => Promise<SpeechSynthesisResult>;

interface DeepgramAudioTestRequest {
  apiKey: string;
  model: string;
  ttsModel: string;
  language: string;
  audio: Blob;
  mimeType: string;
}

interface DeepgramTtsTestRequest {
  apiKey: string;
  model: string;
  ttsModel: string;
  language: string;
  text: string;
}

interface LocalSettingsPageProps {
  repository?: ProviderSettingsRepository;
  onSettingsChange?: (settings: LocalProviderSettings) => void;
  deepgramApiKeyTester?: DeepgramApiKeyTester;
  deepgramAudioRecorder?: DeepgramAudioRecorder;
  deepgramAudioTester?: DeepgramAudioTester;
  deepgramTtsTester?: DeepgramTtsTester;
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
    ttsModel: request.ttsModel,
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

const defaultDeepgramTtsTester: DeepgramTtsTester = request =>
  createDeepgramSpeechProvider({
    apiKey: request.apiKey,
    model: request.model,
    ttsModel: request.ttsModel,
    language: request.language,
    fetchFn: createInstalledNativeDeepgramFetch() ?? undefined,
  }).synthesize({
    feature: 'settings-deepgram-tts-test',
    text: request.text,
    options: {
      ttsModel: request.ttsModel,
      language: request.language,
    },
  });

const LocalSettingsPage: React.FC<LocalSettingsPageProps> = ({
  repository = browserProviderSettingsRepository,
  onSettingsChange,
  deepgramApiKeyTester = defaultDeepgramApiKeyTester,
  deepgramAudioRecorder = defaultDeepgramAudioRecorder,
  deepgramAudioTester = defaultDeepgramAudioTester,
  deepgramTtsTester = defaultDeepgramTtsTester,
}) => {
  const [settings, setSettings] = useState<LocalProviderSettings>(createDefaultLocalProviderSettings);
  const [apiKeyDrafts, setApiKeyDrafts] = useState({ ai: '', speech: '', live: '' });
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
  const [deepgramTtsTest, setDeepgramTtsTest] = useState<{
    state: ConnectionTestState;
    message: string | null;
  }>({ state: 'idle', message: null });
  const [samplePlaybackUrl, setSamplePlaybackUrl] = useState<string | null>(null);
  const [ttsPlaybackUrl, setTtsPlaybackUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const loaded = await repository.load();
        if (!cancelled) {
          setSettings(loaded);
          setApiKeyDrafts({ ai: '', speech: '', live: '' });
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

  useEffect(() => {
    return () => {
      releasePlaybackUrl(ttsPlaybackUrl);
    };
  }, [ttsPlaybackUrl]);

  const snapshots = useMemo(() => buildProviderSettingsSnapshots(settings), [settings]);
  const aiStatus = describeProviderStatus(snapshots.ai);
  const speechStatus = describeProviderStatus(snapshots.speech);
  const liveStatus = describeProviderStatus(snapshots.live);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const settingsToSave = mergeApiKeyDrafts(settings, apiKeyDrafts);
      const saved = await repository.save(settingsToSave);
      setSettings(saved);
      setApiKeyDrafts({ ai: '', speech: '', live: '' });
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
      setApiKeyDrafts({ ai: '', speech: '', live: '' });
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
    setDeepgramTtsTest({ state: 'idle', message: null });
    setSamplePlaybackUrl(current => {
      releasePlaybackUrl(current);
      return null;
    });
    setTtsPlaybackUrl(current => {
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
        ttsModel: settings.speech.ttsModel,
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

  async function handlePlayDeepgramTts() {
    const apiKey = selectSecret(apiKeyDrafts.speech, settings.speech.apiKey);

    if (!apiKey) {
      setDeepgramTtsTest({
        state: 'error',
        message: 'Add a Deepgram API key first',
      });
      return;
    }

    setDeepgramTtsTest({ state: 'testing', message: null });

    try {
      const result = await deepgramTtsTester({
        apiKey,
        model: settings.speech.model,
        ttsModel: settings.speech.ttsModel,
        language: settings.speech.language,
        text: 'Hallo. Ich bin deine DeutschBoost Stimme.',
      });
      const nextUrl = URL.createObjectURL(new Blob([result.audio], { type: result.mimeType }));
      setTtsPlaybackUrl(current => {
        releasePlaybackUrl(current);
        return nextUrl;
      });
      setDeepgramTtsTest({
        state: 'success',
        message: 'Deepgram voice sample is ready',
      });
    } catch (error) {
      setDeepgramTtsTest({
        state: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8" aria-label="Local settings">
      <PageHeader
        title="Local Settings"
        subtitle="Provider keys, models, files, and privacy stay on this device."
      />

      <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
        <Card title="AI Provider">
          <ProviderPanelHeader snapshot={snapshots.ai} />
          <p className="mb-4 text-[12px] text-text-muted">{aiStatus.detail}</p>
          <ToggleRow
            label="Enable OpenRouter"
            checked={settings.ai.enabled}
            onChange={enabled =>
              setSettings(current => ({
                ...current,
                ai: { ...current.ai, enabled },
              }))
            }
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
        </Card>

        <Card title="Realtime Conversation">
          <ProviderPanelHeader snapshot={snapshots.live} />
          <p className="mb-4 text-[12px] text-text-muted">{liveStatus.detail}</p>
          <ToggleRow
            label="Enable Gemini Live"
            checked={settings.live?.enabled ?? false}
            onChange={enabled =>
              setSettings(current => ({
                ...current,
                live: {
                  ...(current.live ?? createDefaultLocalProviderSettings().live!),
                  enabled,
                },
              }))
            }
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SecretField
              label="Gemini Live API key"
              value={apiKeyDrafts.live}
              saved={hasSecret(settings.live?.apiKey)}
              onChange={value =>
                setApiKeyDrafts(current => ({
                  ...current,
                  live: value,
                }))
              }
            />
            <SelectField
              label="Gemini Live model"
              value={settings.live?.model ?? createDefaultLocalProviderSettings().live!.model}
              options={GEMINI_LIVE_MODEL_OPTIONS}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  live: {
                    ...(current.live ?? createDefaultLocalProviderSettings().live!),
                    model: value,
                  },
                }))
              }
            />
            <SelectField
              label="Gemini Live voice"
              value={settings.live?.voiceName ?? createDefaultLocalProviderSettings().live!.voiceName}
              options={GEMINI_LIVE_VOICE_OPTIONS}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  live: {
                    ...(current.live ?? createDefaultLocalProviderSettings().live!),
                    voiceName: value,
                  },
                }))
              }
            />
          </div>
        </Card>

        <Card title="Speech Provider" className="md:col-span-2">
          <ProviderPanelHeader snapshot={snapshots.speech} />
          <p className="mb-4 text-[12px] text-text-muted">{speechStatus.detail}</p>
          <ToggleRow
            label="Enable Deepgram"
            checked={settings.speech.enabled}
            onChange={enabled =>
              setSettings(current => ({
                ...current,
                speech: { ...current.speech, enabled },
              }))
            }
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
              label="Deepgram TTS voice"
              value={settings.speech.ttsModel}
              options={DEEPGRAM_TTS_MODEL_OPTIONS}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, ttsModel: value },
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleTestDeepgram}
              disabled={loading || deepgramTest.state === 'testing'}
            >
              {deepgramTest.state === 'testing' ? 'Testing...' : 'Test key'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleRecordDeepgramAudio}
              disabled={loading || deepgramAudioTest.state === 'testing'}
            >
              {deepgramAudioTest.state === 'testing' ? 'Recording...' : 'Record test audio'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handlePlayDeepgramTts}
              disabled={loading || deepgramTtsTest.state === 'testing'}
            >
              {deepgramTtsTest.state === 'testing' ? 'Preparing...' : 'Play test voice'}
            </Button>
            <ProviderTestMessage state={deepgramTest.state} message={deepgramTest.message} />
          </div>

          {samplePlaybackUrl ? (
            <audio
              className="mt-3 w-full"
              controls
              src={samplePlaybackUrl}
              aria-label="Deepgram test sample playback"
            />
          ) : null}
          <ProviderTestMessage state={deepgramAudioTest.state} message={deepgramAudioTest.message} />
          {ttsPlaybackUrl ? (
            <audio
              className="mt-3 w-full"
              controls
              autoPlay
              src={ttsPlaybackUrl}
              aria-label="Deepgram TTS test playback"
            />
          ) : null}
          <ProviderTestMessage state={deepgramTtsTest.state} message={deepgramTtsTest.message} />
        </Card>

        <Card className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge tone="neutral">Local storage</Badge>
              <h2 className="mt-2 text-[16px] font-semibold text-text">Device only</h2>
              <p className="mt-1 max-w-2xl text-[12px] text-text-muted">
                OpenRouter, Deepgram, and Gemini Live keys stay on this device.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={handleReset}
                disabled={loading || saveState === 'saving'}
              >
                Reset
              </Button>
              <Button type="submit" disabled={loading || saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving...' : 'Save settings'}
              </Button>
            </div>
          </div>
          <SettingsMessage state={saveState} errorMessage={errorMessage} />
        </Card>
      </form>
    </main>
  );
};

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-[13px] font-semibold text-text">
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      className="h-4 w-4 accent-brand-strong"
    />
    <span>{label}</span>
  </label>
);

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface SecretFieldProps extends TextFieldProps {
  saved: boolean;
}

const SecretField: React.FC<SecretFieldProps> = ({ label, value, saved, onChange }) => {
  const inputId = React.useId();

  return (
    <Field label={label} htmlFor={inputId}>
      <input
        id={inputId}
        type="password"
        value={value}
        autoComplete="off"
        placeholder={saved ? 'Paste a new key to replace saved key' : 'Paste API key'}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-control border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-brand focus:outline-none"
      />
      {saved && value.length === 0 ? (
        <em className="text-[12px] not-italic font-medium text-success">Saved key hidden</em>
      ) : null}
    </Field>
  );
};

interface SelectFieldProps extends TextFieldProps {
  options: ProviderModelOption[];
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, options, onChange }) => {
  const selectId = React.useId();

  return (
    <Field label={label} htmlFor={selectId}>
      <select
        id={selectId}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-control border border-border bg-surface px-3 py-2 text-[13px] text-text focus:border-brand focus:outline-none"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
};

const ProviderPanelHeader: React.FC<{ snapshot: ProviderSettingsSnapshot }> = ({ snapshot }) => {
  const status = describeProviderStatus(snapshot);
  const tone =
    status.state === 'configured' ? 'success' : status.state === 'error' ? 'danger' : 'neutral';

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <Badge tone={tone}>{formatProviderHeadline(snapshot)}</Badge>
      <span className="text-[12px] font-medium text-text-muted">{snapshot.model}</span>
    </div>
  );
};

const SettingsMessage: React.FC<{ state: SaveState; errorMessage: string | null }> = ({ state, errorMessage }) => {
  if (state === 'saved') {
    return <p className="mt-3 text-[12px] font-semibold text-success">Settings saved locally</p>;
  }

  if (state === 'reset') {
    return <p className="mt-3 text-[12px] font-semibold text-success">Settings reset</p>;
  }

  if (state === 'error') {
    return (
      <p className="mt-3 text-[12px] font-semibold text-danger">
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

  return (
    <p
      className={cn(
        'text-[12px] font-semibold',
        state === 'success' && 'text-success',
        state === 'error' && 'text-danger',
        state === 'testing' && 'text-text-muted',
      )}
    >
      {message}
    </p>
  );
};

function formatProviderHeadline(snapshot: ProviderSettingsSnapshot): string {
  const status = describeProviderStatus(snapshot);

  if (status.state === 'disabled') {
    if (snapshot.kind === 'ai') {
      return `${snapshot.providerName} AI is off`;
    }

    if (snapshot.kind === 'live') {
      return `${snapshot.providerName} realtime is off`;
    }

    return `${snapshot.providerName} voice is off`;
  }

  return status.headline;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Settings could not be saved';
}

function mergeApiKeyDrafts(
  settings: LocalProviderSettings,
  apiKeyDrafts: { ai: string; speech: string; live: string }
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
    live: {
      ...(settings.live ?? createDefaultLocalProviderSettings().live!),
      ...optionalSecret('apiKey', apiKeyDrafts.live, settings.live?.apiKey),
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
