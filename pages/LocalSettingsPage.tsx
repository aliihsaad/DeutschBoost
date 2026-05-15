import React, { useEffect, useMemo, useState } from 'react';
import {
  buildProviderSettingsSnapshots,
  createDefaultLocalProviderSettings,
  type LocalProviderSettings,
} from '../src/domain/settings/providerSettings';
import type { ProviderSettingsRepository } from '../src/domain/settings/providerSettingsRepository';
import { browserProviderSettingsRepository } from '../src/infrastructure/browser/providerSettingsStorage';
import { describeProviderStatus, type ProviderSettingsSnapshot } from '../src/ui/providerStatusModel';

interface LocalSettingsPageProps {
  repository?: ProviderSettingsRepository;
  onSettingsChange?: (settings: LocalProviderSettings) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'reset' | 'error';

const LocalSettingsPage: React.FC<LocalSettingsPageProps> = ({
  repository = browserProviderSettingsRepository,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<LocalProviderSettings>(createDefaultLocalProviderSettings);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const loaded = await repository.load();
        if (!cancelled) {
          setSettings(loaded);
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

  const snapshots = useMemo(() => buildProviderSettingsSnapshots(settings), [settings]);
  const aiStatus = describeProviderStatus(snapshots.ai);
  const speechStatus = describeProviderStatus(snapshots.speech);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const saved = await repository.save(settings);
      setSettings(saved);
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
      onSettingsChange?.(resetSettings);
      setSaveState('reset');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setSaveState('error');
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
            <TextField
              label="OpenRouter API key"
              type="password"
              value={settings.ai.apiKey ?? ''}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  ai: { ...current.ai, apiKey: value },
                }))
              }
            />
            <TextField
              label="OpenRouter model"
              value={settings.ai.model}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  ai: { ...current.ai, model: value },
                }))
              }
            />
            <TextField
              label="OpenRouter app title"
              value={settings.ai.appTitle ?? ''}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  ai: { ...current.ai, appTitle: value },
                }))
              }
            />
            <TextField
              label="OpenRouter site URL"
              value={settings.ai.siteUrl ?? ''}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  ai: { ...current.ai, siteUrl: value },
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
            <TextField
              label="Deepgram API key"
              type="password"
              value={settings.speech.apiKey ?? ''}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, apiKey: value },
                }))
              }
            />
            <TextField
              label="Deepgram model"
              value={settings.speech.model}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, model: value },
                }))
              }
            />
            <TextField
              label="Deepgram language"
              value={settings.speech.language}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, language: value },
                }))
              }
            />
            <TextField
              label="Deepgram base URL"
              value={settings.speech.baseUrl ?? ''}
              onChange={value =>
                setSettings(current => ({
                  ...current,
                  speech: { ...current.speech, baseUrl: value },
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
  type?: 'text' | 'password';
  value: string;
  onChange: (value: string) => void;
}

const TextField: React.FC<TextFieldProps> = ({ label, type = 'text', value, onChange }) => (
  <label className="db-field">
    <span>{label}</span>
    <input type={type} value={value} onChange={event => onChange(event.target.value)} />
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

export default LocalSettingsPage;
